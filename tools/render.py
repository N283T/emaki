# /// script
# requires-python = ">=3.12"
# dependencies = ["playwright>=1.50", "imageio-ffmpeg>=0.6"]
# ///
"""Record an animation to a video file, frame by frame.

    uv run tools/render.py ecfp                     # -> ecfp.mp4, 1920x1080, 30 fps
    uv run tools/render.py ecfp -o ecfp.webm --fps 60
    uv run tools/render.py ecfp -o clip.gif --start 30 --end 36 --width 960

The page is opened with ?capture and asked to draw each moment through window.komaokuri
({duration, renderAt(seconds)}), so the result does not depend on how fast the machine is.
The container follows the output extension (mp4, webm, mov, gif). Uses the installed Chrome,
or Playwright's Chromium (`uv run --with playwright playwright install chromium`).
"""

import argparse
import functools
import shutil
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import Browser, Playwright, sync_playwright

W, H = 1920, 1080


class _Quiet(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def _browser(p: Playwright) -> Browser:
    try:
        return p.chromium.launch(channel="chrome")
    except Exception:
        return p.chromium.launch()


def _encoder(output: Path, fps: int, width: int) -> subprocess.Popen:
    ffmpeg = shutil.which("ffmpeg") or imageio_ffmpeg.get_ffmpeg_exe()
    scale = f"scale={width}:-2:flags=lanczos"
    if output.suffix == ".gif":
        codec = ["-vf", f"{scale},split[a][b];[a]palettegen[p];[b][p]paletteuse"]
    else:
        codec = ["-vf", scale, "-pix_fmt", "yuv420p"]
    cmd = [
        ffmpeg,
        "-y",
        "-loglevel",
        "error",
        "-f",
        "image2pipe",
        "-framerate",
        str(fps),
        "-c:v",
        "png",
        "-i",
        "-",
        *codec,
        str(output),
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("animation", type=Path, help="animation directory, e.g. ecfp")
    parser.add_argument("-o", "--output", type=Path, help="default: <animation>.mp4")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--width", type=int, default=W, help="output width in pixels")
    parser.add_argument("--start", type=float, default=0.0, help="seconds")
    parser.add_argument("--end", type=float, help="seconds (default: the end)")
    args = parser.parse_args()
    directory = args.animation.resolve()
    output = args.output or Path(f"{directory.name}.mp4")

    handler = functools.partial(_Quiet, directory=str(directory))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        browser = _browser(p)
        page = browser.new_page(viewport={"width": W, "height": H})
        page.goto(f"http://127.0.0.1:{server.server_port}/?capture")
        page.wait_for_function("window.komaokuri")
        page.evaluate("document.fonts.ready")
        end = min(args.end or float("inf"), page.evaluate("komaokuri.duration"))
        frames = round((end - args.start) * args.fps)
        encoder = _encoder(output, args.fps, args.width)
        assert encoder.stdin
        for i in range(frames):
            page.evaluate("t => komaokuri.renderAt(t)", args.start + i / args.fps)
            encoder.stdin.write(page.screenshot())
            if i % args.fps == 0:
                print(
                    f"\r{i / args.fps:.0f} / {frames / args.fps:.0f} s",
                    end="",
                    flush=True,
                )
        encoder.stdin.close()
        browser.close()
    server.shutdown()
    if encoder.wait():
        raise SystemExit("\nffmpeg failed")
    print(f"\r{output} ({frames} frames)")


if __name__ == "__main__":
    main()
