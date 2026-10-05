"""Write an animation as one self-contained HTML file.

    python3 tools/bundle.py ecfp                 # -> ecfp.html
    python3 tools/bundle.py ecfp -o inside.html

The local stylesheets and scripts that index.html links to are inlined; remote ones (fonts)
stay as links.
"""

import argparse
import re
from pathlib import Path

LINK = re.compile(r'<link rel="stylesheet" href="(?!https?:)([^"]+)">')
SCRIPT = re.compile(r'<script src="(?!https?:)([^"]+)"></script>')


def bundle(directory: Path) -> str:
    html = (directory / "index.html").read_text()
    html = LINK.sub(
        lambda m: f"<style>\n{(directory / m[1]).read_text()}</style>", html
    )
    return SCRIPT.sub(
        lambda m: f"<script>\n{(directory / m[1]).read_text()}</script>", html
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("animation", type=Path, help="animation directory, e.g. ecfp")
    parser.add_argument("-o", "--output", type=Path, help="default: <animation>.html")
    args = parser.parse_args()
    output = args.output or Path(f"{args.animation.name}.html")
    output.write_text(bundle(args.animation))
    print(output)


if __name__ == "__main__":
    main()
