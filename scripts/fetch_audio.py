import pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[1]/'public'
base='https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/'
for instrument,notes in [('piano',['C3','C4','C5']),('cello',['C2','C3','C4']),('violin',['G3','C4','C5'])]:
 d=root/'audio'/instrument;d.mkdir(parents=True,exist_ok=True)
 for n in notes: subprocess.run(['curl','-fsSL',base+f'samples/{instrument}/{n}.mp3','-o',str(d/(n+'.mp3'))],check=True)
subprocess.run(['curl','-fsSL',base+'LICENSE.md','-o',str(root/'sources/audio-license.txt')],check=True)
(root/'fonts').mkdir(exist_ok=True)
subprocess.run(['curl','-fsSL','https://raw.githubusercontent.com/steinbergmedia/bravura/master/redist/woff/Bravura.woff2','-o',str(root/'fonts/Bravura.woff2')],check=True)
subprocess.run(['curl','-fsSL','https://raw.githubusercontent.com/steinbergmedia/bravura/master/LICENSE.txt','-o',str(root/'sources/Bravura-LICENSE.txt')],check=True)
