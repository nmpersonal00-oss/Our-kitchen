from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import shutil
root=Path('/mnt/data/The_Little_Kitchen_V8_Exact_Reference')
assets=root/'assets'; assets.mkdir(exist_ok=True)
mapping={
 'grocery':'GROCCERIES CLEANED.PNG',
 'recipes':'RECIPIES TAB CLEANED.PNG',
 'food':'FOOD TAB CLEANED.PNG',
 'drink':'DRINKS TAB CLEANED.PNG',
 'dessert':'DESSERTS TAB CLEANED.PNG',
 'settings':'SETTINGS TAB CLEANED.PNG',
}
for key,filename in mapping.items():
 shutil.copy2(Path('/mnt/data')/filename,assets/f'reference-{key}.png')
# Cropped recipe photographs from the user's *actual reference example screenshots*.
# Only extract the image area: no controls or label overlays.
crops={
 'pumpkin-soup':('FOOD TAB EXAMPLE.PNG',(45,742,394,942)),
 'herb-pasta':('FOOD TAB EXAMPLE.PNG',(444,742,793,942)),
 'chai-latte':('DRINKS TAB EXAMPLE.PNG',(45,826,394,1050)),
 'spiced-cider':('DRINKS TAB EXAMPLE.PNG',(444,826,793,1050)),
 'cinnamon-rolls':('DESSERTS TAB EXAMPLE.PNG',(45,733,394,947)),
 'apple-crumble':('DESSERTS TAB EXAMPLE.PNG',(444,733,793,947)),
 'strawberry':('DESSERTS TAB EXAMPLE.PNG',(45,1183,394,1367)),
 'brownie':('DESSERTS TAB EXAMPLE.PNG',(444,1183,793,1367)),
}
for key,(name,box) in crops.items():
 im=Image.open(Path('/mnt/data')/name).convert('RGB').crop(box)
 im.save(assets/f'reference-recipe-{key}.webp','WEBP',quality=96,method=6)
# contact sheet
canvas=Image.new('RGB',(4*250,2*190),(30,20,17))
d=ImageDraw.Draw(canvas)
for i,k in enumerate(crops):
 im=Image.open(assets/f'reference-recipe-{k}.webp'); im=ImageOps.fit(im,(244,160))
 x=(i%4)*250;y=(i//4)*190
 canvas.paste(im,(x,y)); d.text((x+5,y+165),k,fill=(255,255,255))
canvas.save('/mnt/data/Little_Kitchen_V8_Cropped_Reference_Images.jpg',quality=91)
print('copied',list(mapping.values()),'crops',len(crops))
