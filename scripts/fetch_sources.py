"""Fetch and pin openly licensed Fux transcriptions; run only to refresh source data."""
import json, subprocess, concurrent.futures, pathlib, re
root=pathlib.Path(__file__).resolve().parents[1]
def fetch(url): return subprocess.check_output(['curl','-fsSL',url]).decode()
tree=json.loads(fetch('https://api.github.com/repos/MarkGotham/species/git/trees/main?recursive=1'))
sha=tree['sha']; base=f'https://raw.githubusercontent.com/MarkGotham/species/{sha}/'
paths=[x['path'] for x in tree['tree'] if re.match(r'^(I|II|III)/sp[1-5]/gap_\d+[^/]*\.json$',x['path'])]
def get(path):
    meta=json.loads(re.sub(r',\s*([}\]])', r'\1', fetch(base+path)));  krn=fetch(base+path[:-5]+'.krn')
    return {'metadata':meta,'kern':krn,'path':path,'commit':sha}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: rows=list(pool.map(get, paths))
(root/'public/sources/fux.json').write_text(json.dumps(rows,ensure_ascii=False))
(root/'public/sources/README.md').write_text(fetch(base+'README.md'))
print(f'Pinned {len(rows)} examples at {sha}')
