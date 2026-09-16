"""Package generated category artwork at runtime resolution; no procedural art."""
from pathlib import Path
from PIL import Image
import json
root = Path(__file__).resolve().parents[1]
for entry in json.loads((root / 'docs/art/category-icons.json').read_text()):
    source = root / 'images/concepts/categories' / (entry['id'] + '.png')
    if not source.exists():
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_bytes(Path(entry['source']).read_bytes())
    image = Image.open(source).convert('RGBA')
    assert image.getchannel('A').getextrema()[0] == 0, 'Expected real transparency'
    image.resize((128, 128), Image.Resampling.LANCZOS).save(root / 'images/hud/categories' / (entry['id'] + '.png'), optimize=True)
