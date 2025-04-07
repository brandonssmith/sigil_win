import curses
import requests
import textwrap
import time

# Define backend URL globally or pass it around
BACKEND_BASE_URL = "http://localhost:8000"

def setup_windows(stdscr):
    curses.curs_set(1) # Show cursor
    stdscr.nodelay(0)  # Wait for user input
    stdscr.timeout(-1) # Block indefinitely on getch

    curses.start_color()
    curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK) # User Input
    curses.init_pair(2, curses.COLOR_WHITE, curses.COLOR_BLACK) # AI/System Message
    curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK) # Status/Info

    max_y, max_x = stdscr.getmaxyx()

    # Status window (top 1 line)
    status_h = 1
    status_w = max_x
    status_y = 0
    status_x = 0
    status_win = curses.newwin(status_h, status_w, status_y, status_x)

    # Chat history window (top 80%)
    hist_h = int((max_y - status_h) * 0.8)
    hist_w = max_x
    hist_y = status_h
    hist_x = 0
    hist_win = curses.newwin(hist_h, hist_w, hist_y, hist_x)
    hist_win.scrollok(True)
    hist_win.idlok(True)
    hist_win.box()
    hist_win.addstr(0, 2, " Chat History ")

    # Input window (bottom 20% - border)
    input_h = max_y - status_h - hist_h
    input_w = max_x
    input_y = status_h + hist_h
    input_x = 0
    input_win = curses.newwin(input_h, input_w, input_y, input_x)
    input_win.keypad(True)
    input_win.box()
    input_win.addstr(0, 2, " Input (Ctrl+C to exit) ")

    stdscr.refresh()
    # Initial status message
    update_status(status_win, "Initializing...")
    hist_win.refresh()
    input_win.refresh()

    return status_win, hist_win, input_win

def update_status(status_win, message):
    """Clears and updates the status line."""
    max_y, max_x = status_win.getmaxyx()
    status_win.clear()
    try:
        status_win.addnstr(0, 0, message, max_x - 1, curses.color_pair(3) | curses.A_BOLD)
    except curses.error:
        pass # Ignore errors if window is too small
    status_win.refresh()

def add_message(win, sender, message, color_pair):
    max_y, max_x = win.getmaxyx()
    win_width = max_x - 4 # Account for borders and padding

    lines = textwrap.wrap(f"{sender}: {message}", width=win_width)
    for line in lines:
        win.scroll(1)
        win.insstr(max_y - 2, 2, line + "\n", curses.color_pair(color_pair))
        win.box()
        win.addstr(0, 2, " Chat History ") # Redraw title
        win.refresh()
        time.sleep(0.01) # Small delay for visual effect

def get_input(win):
    max_y, max_x = win.getmaxyx()
    input_field_y = max_y // 2
    input_field_x = 2
    win_width = max_x - 4

    curses.echo()
    win.move(input_field_y, input_field_x)
    win.clrtoeol()
    win.box()
    win.addstr(0, 2, " Input (Ctrl+C to exit) ")
    win.refresh()

    # Read input char by char to handle potential resize/interrupts
    input_str = ""
    while True:
        try:
            ch = win.getch(input_field_y, input_field_x + len(input_str))
            if ch == curses.ERR:
                continue # No input yet
            elif ch == 10: # Enter key
                break
            elif ch == curses.KEY_BACKSPACE or ch == 127:
                if len(input_str) > 0:
                    input_str = input_str[:-1]
                    # Move cursor back, print space, move cursor back again
                    win.addstr(input_field_y, input_field_x + len(input_str), ' ')
                    win.move(input_field_y, input_field_x + len(input_str))
            elif ch >= 32 and ch <= 126: # Printable ASCII chars
                if len(input_str) < win_width - 1:
                    input_str += chr(ch)
                    win.addstr(input_field_y, input_field_x + len(input_str) - 1, chr(ch))
            # Handle other keys (arrows, etc.) if needed, otherwise ignore
            win.refresh()
        except KeyboardInterrupt:
            raise # Re-raise Ctrl+C to allow exit

    curses.noecho()
    return input_str.strip()

def send_to_backend(message, backend_url=f"{BACKEND_BASE_URL}/chat"):
    try:
        response = requests.post(backend_url, json={"message": message}, timeout=60)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        return response.json().get("response", "Error: No response field in JSON")
    except requests.exceptions.RequestException as e:
        return f"Error connecting to backend: {e}"
    except Exception as e:
        return f"Error processing backend response: {e}"

def get_vram_info_from_backend(backend_url=f"{BACKEND_BASE_URL}/vram"):
    """Fetches VRAM info from the backend."""
    try:
        response = requests.get(backend_url, timeout=5) # Shorter timeout for status check
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "ok":
            if "total_gb" in data:
                # Format the VRAM string
                return (f"GPU: {data.get('device', 'N/A')} | "
                        f"VRAM Used: {data.get('allocated_gb', 0):.2f} GB / "
                        f"{data.get('total_gb', 0):.2f} GB")
            else:
                return data.get("message", "VRAM info not available.")
        else:
            return f"Error from backend /vram: {data.get('message', 'Unknown error')}"
    except requests.exceptions.RequestException as e:
        return f"Error connecting to backend /vram: {e}"
    except Exception as e:
        return f"Error processing /vram response: {e}"

def run_chat_ui(stdscr):
    status_win, hist_win, input_win = setup_windows(stdscr)

    # Get and display initial VRAM info
    vram_status = get_vram_info_from_backend()
    update_status(status_win, vram_status)

    add_message(hist_win, "System", "Welcome! Type your message below and press Enter.", 2)

    while True:
        try:
            user_input = get_input(input_win)
            if not user_input:
                continue

            add_message(hist_win, "You", user_input, 1)

            # Clear input window before showing thinking message
            max_y, max_x = input_win.getmaxyx()
            input_win.move(max_y // 2, 2)
            input_win.clrtoeol()
            input_win.box()
            input_win.addstr(0, 2, " Input (Ctrl+C to exit) ")
            input_win.addstr(max_y // 2, 2, "Thinking...", curses.A_DIM)
            input_win.refresh()

            response = send_to_backend(user_input)

            # Clear thinking message
            input_win.move(max_y // 2, 2)
            input_win.clrtoeol()
            input_win.box()
            input_win.addstr(0, 2, " Input (Ctrl+C to exit) ")
            input_win.refresh()

            add_message(hist_win, "AI", response, 2)

        except KeyboardInterrupt:
            add_message(hist_win, "System", "Exiting...", 2)
            time.sleep(1)
            break
        except Exception as e:
            # Display error in hist_win and allow continuation or exit
            curses.flash()
            add_message(hist_win, "System", f"An error occurred: {e}", 2)
            add_message(hist_win, "System", "Press Enter to continue or Ctrl+C to exit...", 2)
            try:
                input_win.getch() # Wait for Enter
            except KeyboardInterrupt:
                break # Exit on Ctrl+C

def main():
    curses.wrapper(run_chat_ui)

if __name__ == "__main__":
    main() 