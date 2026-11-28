import {Shape} from 'three';

// Cross section before the 4 mm edge bevel, in the tablet's own XY plane.
export function tabletSize(model,type){
  if(type==='urna')return {width:model.sirka,height:model.dlzka};
  if(type==='pamatna')return {width:model.sirka,height:model.vyskaStely};
  return {width:model.sirka*(model.zostava?.sirkaStely??.78),height:model.vyskaStely};
}

const studioProfiles=new Map();
export function setStudioProfile(profile,variants=[]){
  studioProfiles.clear();
  studioProfiles.set('atelierovy',profile);
  for(const variant of variants)studioProfiles.set(variant.id,variant);
}

// Narrow feet for profiles that do not rest on the full pedestal width.
const feet={oval:.64,obelisk:.5,krizova:.4,srdce:.6};
// Profiles whose layered backing is built in the model, not in the outline.
export const layered={vrstveny:2};

export function outline(width,height,profile){
  const shape=new Shape(),half=width/2,h=height;
  const custom=studioProfiles.get(profile);
  const foot=custom?.foot??feet[profile]??1;
  shape.moveTo(-half*foot,0);shape.lineTo(half*foot,0);
  function line(x,y){shape.lineTo(x*half,y*h);}
  function quad(x1,y1,x,y){shape.quadraticCurveTo(x1*half,y1*h,x*half,y*h);}
  function curve(x1,y1,x2,y2,x,y){shape.bezierCurveTo(x1*half,y1*h,x2*half,y2*h,x*half,y*h);}
  if(custom){
    for(const segment of custom.outline){
      if(segment.length===2)line(...segment);
      else curve(...segment);
    }
  }else switch(profile){
    case 'obluk':
      line(1,.86);curve(.52,1.045,-.52,1.045,-1,.86);break;
    case 'ramena':
      line(1,.78);quad(.78,.78,.63,.86);quad(0,1.14,-.63,.86);quad(-.78,.78,-1,.78);break;
    case 'stit':
      line(1,.79);line(0,1);line(-1,.79);break;
    case 'vlna':
      line(1,.80);curve(.20,.65,-.19,1.10,-1,.94);break;
    case 'zrezane-rohy':
      line(1,.76);line(.55,1);line(-.55,1);line(-1,.76);break;
    case 'sikmy':
      line(1,.72);line(-1,1);break;
    case 'oval':
      curve(.87,.13,1,.29,1,.48);curve(1,.77,.57,1,0,1);
      curve(-.57,1,-1,.77,-1,.48);curve(-1,.29,-.87,.13,-foot,0);break;
    case 'zaobleny':
      line(1,.76);curve(1,.90,.89,1,.65,1);line(-.65,1);
      curve(-.89,1,-1,.90,-1,.76);break;
    case 'stupnovity':
      line(1,.71);line(.58,.71);line(.58,1);line(-.58,1);
      line(-.58,.71);line(-1,.71);break;
    case 'slza':
      line(1,.56);curve(1,.76,.86,.94,.65,.988);
      quad(.61,1,.58,.975);curve(.45,.86,.25,.85,-.10,.79);curve(-.66,.69,-1,.63,-1,.39);break;
    case 'srdce':
      // Two full lobes meet in a soft notch; the base stays straight on the pedestal.
      curve(.80,.16,1,.38,1,.60);curve(1,.86,.82,1,.53,1);curve(.25,1,.07,.92,0,.77);
      curve(-.07,.92,-.25,1,-.53,1);curve(-.82,1,-1,.86,-1,.60);curve(-1,.38,-.80,.16,-.6,0);break;
    case 'dvojity-obluk':
      line(1,.80);curve(1,.95,.80,1.005,.52,1.005);curve(.25,1.005,.06,.95,0,.885);
      curve(-.06,.95,-.25,1.005,-.52,1.005);curve(-.80,1.005,-1,.95,-1,.80);break;
    case 'goticky':
      line(1,.66);curve(1,.83,.50,.91,0,1);curve(-.50,.91,-1,.83,-1,.66);break;
    case 'lomeny':
      // A split, irregular crown; the matt sides read as natural cleft stone.
      for(const [x,y] of [[1,.80],[.90,.87],[.77,.85],[.63,.94],[.47,.91],[.33,.985],
        [.16,.955],[.02,1],[-.15,.95],[-.31,.975],[-.47,.905],[-.61,.935],[-.76,.86],[-.89,.885],[-1,.82]])line(x,y);
      break;
    case 'obelisk':
      line(.40,.84);line(0,1);line(-.40,.84);break;
    case 'krizova':
      line(.4,.60);line(1,.60);line(1,.79);line(.4,.79);line(.4,1);
      line(-.4,1);line(-.4,.79);line(-1,.79);line(-1,.60);line(-.4,.60);break;
    case 'vrstveny':
      line(1,.84);curve(.62,.98,.22,.80,-.30,.95);curve(-.62,1.04,-.90,1,-1,.92);break;
    default:
      line(1,1);line(-1,1);
  }
  shape.closePath();return shape;
}

export function bookLeaf(width,h,sign){
  const leaf=new Shape();
  leaf.moveTo(0,.03);leaf.quadraticCurveTo(sign*width*.48,.072,sign*width*.95,.045);
  leaf.quadraticCurveTo(sign*width,.043,sign*width,.062);
  leaf.lineTo(sign*width,h*.86);leaf.quadraticCurveTo(sign*width,h*.90,sign*width*.95,h*.91);leaf.quadraticCurveTo(sign*width*.48,h*1.046,0,h*.89);
  leaf.closePath();
  return leaf;
}
