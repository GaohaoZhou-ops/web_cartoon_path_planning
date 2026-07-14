#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT_DIR/.service"
VITE_BIN="$ROOT_DIR/node_modules/.bin/vite"
DEFAULT_PORT=5173
AUTO_PORT_SCAN_LIMIT=100
START_LOCK_FILE="$RUNTIME_DIR/route-lab-start.lock"
START_LOCK_METHOD=""

usage() {
  echo "用法:"
  echo "示例: $0"
  echo "      $0 start 5173"
  echo "      $0 status"
  echo "      $0 status 5173"
  echo "      $0 stop 12345"
  echo "      $0 stop"
}

validate_port() {
  local port="$1"
  if [[ ! "$port" =~ ^[1-9][0-9]{0,4}$ ]] || ((port > 65535)); then
    echo "错误: 端口号必须是 1-65535 之间的整数。" >&2
    exit 2
  fi
}

validate_pid() {
  local pid="$1"
  if [[ ! "$pid" =~ ^[1-9][0-9]*$ ]] || [[ "$pid" == "1" ]]; then
    echo "错误: 进程号必须是大于 1 的整数。" >&2
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
  process_matches_project "$pid" && [[ "$(process_port "$command")" == "$port" ]]
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

  nohup "$VITE_BIN" --host 0.0.0.0 --port "$port" --strictPort >"$log_file" 2>&1 9>&- &
  pid=$!
  printf '%s\n' "$pid" >"$pid_file"

  for _ in {1..50}; do
    if port_is_listening "$port" && process_is_running "$pid" && process_matches_service "$pid" "$port"; then
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
    if ! process_is_running "$pid"; then
      remove_pid_files_for_pid "$pid"
      return 0
    fi
    remove_pid_files_for_pid "$pid"
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

remove_pid_files_for_pid() {
  local pid="$1"
  local pid_file
  local recorded_pid

  [[ -d "$RUNTIME_DIR" ]] || return 0
  for pid_file in "$RUNTIME_DIR"/route-lab-*.pid; do
    [[ -e "$pid_file" ]] || continue
    recorded_pid="$(<"$pid_file")"
    if [[ "$recorded_pid" == "$pid" ]]; then
      rm -f "$pid_file"
    fi
  done
}

stop_service_by_pid() {
  local pid="$1"
  local pid_file
  local recorded_pid
  local port
  local result

  if ! process_is_running "$pid"; then
    remove_pid_files_for_pid "$pid"
    echo "进程 $pid 未运行，已清理可能存在的过期 PID 记录。"
    return 0
  fi

  if ! process_matches_project "$pid"; then
    if ! process_is_running "$pid"; then
      remove_pid_files_for_pid "$pid"
      echo "进程 $pid 已停止，已清理过期 PID 记录。"
      return 0
    fi
    remove_pid_files_for_pid "$pid"
    echo "错误: PID $pid 不属于当前工程；未执行停止。" >&2
    return 1
  fi

  if [[ -d "$RUNTIME_DIR" ]]; then
    for pid_file in "$RUNTIME_DIR"/route-lab-*.pid; do
      [[ -e "$pid_file" ]] || continue
      recorded_pid="$(<"$pid_file")"
      [[ "$recorded_pid" == "$pid" ]] || continue
      port="${pid_file##*/route-lab-}"
      port="${port%.pid}"
      if [[ "$port" =~ ^[0-9]+$ ]] && process_matches_service "$pid" "$port"; then
        if stop_service "$port"; then
          remove_pid_files_for_pid "$pid"
          return 0
        else
          result=$?
        fi
        if ! process_is_running "$pid"; then
          remove_pid_files_for_pid "$pid"
        fi
        return "$result"
      fi
    done
  fi

  if stop_project_process "$pid"; then
    remove_pid_files_for_pid "$pid"
    return 0
  fi

  return 1
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

process_port() {
  local command="$1"
  local port_pattern='(^|[[:space:]])--port([=[:space:]]+)([0-9]+)($|[[:space:]])'

  if [[ "$command" =~ $port_pattern ]]; then
    printf '%s\n' "${BASH_REMATCH[3]}"
  else
    printf '%s\n' "-"
  fi
}

show_all_statuses() {
  local pid
  local port
  local start_time
  local elapsed_time
  local command
  local access_url
  local found=0

  while read -r pid; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    if ! process_is_running "$pid" || ! process_matches_project "$pid"; then
      continue
    fi

    start_time="$(ps -p "$pid" -o lstart= 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true)"
    elapsed_time="$(ps -p "$pid" -o etime= 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true)"
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"

    # 进程可能在扫描和读取详情之间退出，此时不输出一条空记录。
    [[ -n "$command" ]] || continue
    port="$(process_port "$command")"
    if [[ "$port" == "-" ]]; then
      access_url="-"
    else
      access_url="http://127.0.0.1:$port/"
    fi

    if ((found == 0)); then
      echo "本工程运行中的服务："
      printf '%-8s %-7s %-24s %-12s %-30s %s\n' "PID" "端口" "启动时间" "已运行时间" "访问地址" "进程"
    fi

    [[ -n "$start_time" ]] || start_time="-"
    [[ -n "$elapsed_time" ]] || elapsed_time="-"
    printf '%-8s %-7s %-24s %-12s %-30s %s\n' "$pid" "$port" "$start_time" "$elapsed_time" "$access_url" "$command"
    found=1
  done < <(ps -axo pid=)

  if ((found == 0)); then
    echo "本工程没有运行中的服务。"
    return 1
  fi

  return 0
}

project_service_is_running() {
  local pid

  while read -r pid; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    if process_is_running "$pid" && process_matches_project "$pid"; then
      return 0
    fi
  done < <(ps -axo pid=)

  return 1
}

find_available_port() {
  local port="$DEFAULT_PORT"
  local checked=0

  while ((port <= 65535 && checked < AUTO_PORT_SCAN_LIMIT)); do
    if ! port_is_listening "$port"; then
      printf '%s\n' "$port"
      return 0
    fi
    ((port += 1))
    ((checked += 1))
  done

  return 1
}

acquire_start_lock() {
  if ! mkdir -p "$RUNTIME_DIR"; then
    echo "错误: 无法创建服务运行目录。" >&2
    return 1
  fi
  if command -v flock >/dev/null 2>&1; then
    if ! exec 9>"$START_LOCK_FILE"; then
      echo "错误: 无法打开服务启动锁。" >&2
      return 1
    fi
    if flock -w 30 9 >/dev/null 2>&1; then
      START_LOCK_METHOD="fd"
      return 0
    fi
    exec 9>&-
  elif command -v lockf >/dev/null 2>&1; then
    if ! exec 9>"$START_LOCK_FILE"; then
      echo "错误: 无法打开服务启动锁。" >&2
      return 1
    fi
    if lockf -s -t 30 9 >/dev/null 2>&1; then
      START_LOCK_METHOD="fd"
      return 0
    fi
    exec 9>&-
  elif command -v shlock >/dev/null 2>&1; then
    for _ in {1..300}; do
      if shlock -p "$$" -f "$START_LOCK_FILE" >/dev/null 2>&1; then
        START_LOCK_METHOD="shlock"
        return 0
      fi
      sleep 0.1
    done
  else
    echo "错误: 系统缺少 flock、lockf 或 shlock，无法安全启动服务。" >&2
    return 1
  fi

  echo "错误: 另一个服务启动操作在 30 秒内未完成，请稍后重试。" >&2
  return 1
}

release_start_lock() {
  local owner=""

  if [[ "$START_LOCK_METHOD" == "fd" ]]; then
    exec 9>&-
  elif [[ "$START_LOCK_METHOD" == "shlock" ]]; then
    if [[ -f "$START_LOCK_FILE" ]]; then
      owner="$(<"$START_LOCK_FILE")"
    fi
    if [[ "$owner" == "$$" ]]; then
      rm -f "$START_LOCK_FILE"
    fi
  fi
  START_LOCK_METHOD=""
}

run_default_mode() {
  local port
  local start_result=0
  local status_result=0

  if ! acquire_start_lock; then
    return 1
  fi
  trap 'release_start_lock' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  if project_service_is_running; then
    echo "检测到当前工程已有运行中的服务，未重复启动。"
  else
    if ! port="$(find_available_port)"; then
      echo "错误: 从端口 $DEFAULT_PORT 开始的 $AUTO_PORT_SCAN_LIMIT 个候选端口均不可用。" >&2
      start_result=1
    elif ! start_service "$port"; then
      start_result=1
    fi
  fi

  release_start_lock
  trap - EXIT INT TERM
  if ((start_result != 0)); then
    return "$start_result"
  fi

  echo
  if ! show_all_statuses; then
    status_result=1
  fi
  echo
  echo "关闭某个服务: $0 stop <进程号>"
  echo "关闭全部服务: $0 stop"
  return "$status_result"
}

if [[ $# -eq 0 ]]; then
  run_default_mode
  exit $?
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
    if [[ $# -eq 1 ]]; then
      stop_all_services
    elif [[ $# -eq 2 ]]; then
      pid="$2"
      validate_pid "$pid"
      stop_service_by_pid "$pid"
    else
      usage
      exit 2
    fi
    ;;
  status)
    if [[ $# -eq 1 ]]; then
      show_all_statuses
    elif [[ $# -eq 2 ]]; then
      port="$2"
      validate_port "$port"
      show_status "$port"
    else
      usage
      exit 2
    fi
    ;;
  *)
    usage
    exit 2
    ;;
esac
