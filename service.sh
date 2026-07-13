#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.service"
VITE_BIN="$ROOT_DIR/node_modules/.bin/vite"

usage() {
  echo "用法:"
  echo "示例: $0 start 5173"
  echo "      $0 status 5173"
  echo "      $0 stop"
}

validate_port() {
  local port="$1"
  if [[ ! "$port" =~ ^[0-9]+$ ]] || ((port < 1 || port > 65535)); then
    echo "错误: 端口号必须是 1-65535 之间的整数。" >&2
    exit 2
  fi
}

port_is_listening() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
  elif command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
  else
    curl --silent --max-time 1 "http://127.0.0.1:$port/" >/dev/null 2>&1
  fi
}

process_is_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

process_matches_service() {
  local pid="$1"
  local port="$2"
  local command
  command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  process_matches_project "$pid" && [[ "$command" == *"--port $port"* ]]
}

process_working_directory() {
  local pid="$1"
  if [[ -L "/proc/$pid/cwd" ]]; then
    readlink "/proc/$pid/cwd" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
  fi
}

process_matches_project() {
  local pid="$1"
  local command
  local executable
  local working_directory
  executable="$(ps -p "$pid" -o comm= 2>/dev/null || true)"
  executable="${executable##*/}"
  [[ "$executable" == "node" || "$executable" == "nodejs" ]] || return 1
  command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$command" == *"vite"* ]] || return 1
  [[ "$command" == *"$ROOT_DIR/node_modules/"* ]] && return 0
  working_directory="$(process_working_directory "$pid")"
  [[ "$working_directory" == "$ROOT_DIR" ]]
}

start_service() {
  local port="$1"
  local pid_file="$RUNTIME_DIR/route-lab-$port.pid"
  local log_file="$RUNTIME_DIR/route-lab-$port.log"
  local pid

  mkdir -p "$RUNTIME_DIR"

  if [[ -f "$pid_file" ]]; then
    pid="$(<"$pid_file")"
    if [[ "$pid" =~ ^[0-9]+$ ]] && process_is_running "$pid" && process_matches_service "$pid" "$port"; then
      echo "服务已在运行: http://127.0.0.1:$port/ (PID $pid)"
      return 0
    fi
    rm -f "$pid_file"
  fi

  if port_is_listening "$port"; then
    echo "错误: 端口 $port 已被其他进程占用。" >&2
    return 1
  fi

  if [[ ! -x "$VITE_BIN" ]]; then
    echo "错误: 未找到 Vite，请先在项目目录执行 npm install。" >&2
    return 1
  fi

  nohup "$VITE_BIN" --host 0.0.0.0 --port "$port" --strictPort >"$log_file" 2>&1 &
  pid=$!
  printf '%s\n' "$pid" >"$pid_file"

  for _ in {1..50}; do
    if port_is_listening "$port"; then
      echo "服务启动成功: http://127.0.0.1:$port/"
      echo "PID: $pid"
      echo "日志: $log_file"
      return 0
    fi
    if ! process_is_running "$pid"; then
      break
    fi
    sleep 0.2
  done

  rm -f "$pid_file"
  echo "错误: 服务启动失败，最近日志如下：" >&2
  tail -n 20 "$log_file" >&2 2>/dev/null || true
  return 1
}

stop_service() {
  local port="$1"
  local pid_file="$RUNTIME_DIR/route-lab-$port.pid"
  local pid

  if [[ ! -f "$pid_file" ]]; then
    if port_is_listening "$port"; then
      echo "错误: 端口 $port 正在使用，但不是由此脚本管理的服务；未执行停止。" >&2
      return 1
    fi
    echo "服务未运行: 端口 $port"
    return 0
  fi

  pid="$(<"$pid_file")"
  if [[ ! "$pid" =~ ^[0-9]+$ ]]; then
    rm -f "$pid_file"
    echo "错误: PID 文件无效，已清理。" >&2
    return 1
  fi

  if ! process_is_running "$pid"; then
    rm -f "$pid_file"
    echo "服务已停止，已清理过期 PID 文件。"
    return 0
  fi

  if ! process_matches_service "$pid" "$port"; then
    echo "错误: PID $pid 与端口 $port 的 Route/Lab 服务不匹配；未执行停止。" >&2
    return 1
  fi

  kill "$pid"
  for _ in {1..25}; do
    if ! process_is_running "$pid"; then
      rm -f "$pid_file"
      echo "服务已停止: 端口 $port (PID $pid)"
      return 0
    fi
    sleep 0.2
  done

  kill -9 "$pid" >/dev/null 2>&1 || true
  rm -f "$pid_file"
  echo "服务已强制停止: 端口 $port (PID $pid)"
}

stop_project_process() {
  local pid="$1"

  if ! process_is_running "$pid"; then
    return 0
  fi
  if ! process_matches_project "$pid"; then
    echo "错误: PID $pid 不属于当前工程；未执行停止。" >&2
    return 1
  fi

  kill "$pid"
  for _ in {1..25}; do
    if ! process_is_running "$pid"; then
      echo "已停止未登记的工程服务 (PID $pid)"
      return 0
    fi
    sleep 0.2
  done

  kill -9 "$pid" >/dev/null 2>&1 || true
  echo "已强制停止未登记的工程服务 (PID $pid)"
}

stop_all_services() {
  local pid_file
  local port
  local pid
  local found=0
  local failed=0

  if [[ -d "$RUNTIME_DIR" ]]; then
    for pid_file in "$RUNTIME_DIR"/route-lab-*.pid; do
      [[ -e "$pid_file" ]] || continue
      found=1
      port="${pid_file##*/route-lab-}"
      port="${port%.pid}"
      if ! stop_service "$port"; then
        failed=1
      fi
    done
  fi

  while read -r pid; do
    [[ -n "$pid" ]] || continue
    if process_is_running "$pid" && process_matches_project "$pid"; then
      found=1
      if ! stop_project_process "$pid"; then
        failed=1
      fi
    fi
  done < <(
    while read -r pid _; do
      if [[ -n "$pid" ]] && process_matches_project "$pid"; then
        printf '%s\n' "$pid"
      fi
    done < <(ps -axo pid=,command=)
  )

  if ((found == 0)); then
    echo "本工程没有运行中的服务。"
  elif ((failed == 0)); then
    echo "本工程所有服务已停止。"
  fi

  return "$failed"
}

show_status() {
  local port="$1"
  local pid_file="$RUNTIME_DIR/route-lab-$port.pid"
  local pid

  if [[ -f "$pid_file" ]]; then
    pid="$(<"$pid_file")"
    if [[ "$pid" =~ ^[0-9]+$ ]] && process_is_running "$pid" && process_matches_service "$pid" "$port"; then
      echo "运行中: http://127.0.0.1:$port/ (PID $pid)"
      return 0
    fi
  fi

  echo "未运行: 端口 $port"
  return 1
}

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

action="$1"

case "$action" in
  start)
    [[ $# -eq 2 ]] || { usage; exit 2; }
    port="$2"
    validate_port "$port"
    start_service "$port"
    ;;
  stop)
    [[ $# -eq 1 ]] || { usage; exit 2; }
    stop_all_services
    ;;
  status)
    [[ $# -eq 2 ]] || { usage; exit 2; }
    port="$2"
    validate_port "$port"
    show_status "$port"
    ;;
  *)
    usage
    exit 2
    ;;
esac
