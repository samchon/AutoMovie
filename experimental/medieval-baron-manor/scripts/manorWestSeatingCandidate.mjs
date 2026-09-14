import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Executable, finite candidate against the corrected hall end-apron recipe. Nothing is published by
// this module: it constructs exact alternate recipes in memory for inspection.
const sha = text => createHash('sha256').update(text).digest('hex');
const replace = (text, before, after) => {
  assert.equal(text.split(before).length, 2, `Candidate requires one exact source occurrence: ${before}`);
  return text.replace(before, after);
};
export async function createWestSeatingCandidate() {
  let manor = readFileSync(new URL('../src/models/manor.js', import.meta.url), 'utf8');
  let craft = readFileSync(new URL('../src/models/manor-craft.js', import.meta.url), 'utf8');
  const basis = { manor: sha(manor), craft: sha(craft) };
  assert.equal(basis.manor, 'b70aa2187719f3df96d2986d071f35fd690b15de11c184418f251ee72b7d87dc');
  assert.equal(basis.craft, 'f76095ce676ba83a6f3f1852b137c4e10b673e5a1d720e05f01095562afc2129');
  manor = replace(manor, "bench('hall-bench-west',-7.16", "bench('hall-bench-west',-7.22");
  manor = replace(manor, "rug('hall-rug',-6.55,.45,2.35,1.56", "rug('hall-rug',-6.55,.45,2.35,1.66");
  manor = replace(manor, "['hall-lamp',-7.3725,1.92", "['hall-lamp',-7.3725,2.27");
  // This one broad infill bay lies between the two hall windows. Move its
  // positive plaster face and the adjoining exposed timber returns together.
  manor = replace(manor, 'p=(u,v,z)=>pt(u,y+v,z);',
    "p=(u,v,z)=>pt(u,y+v,id==='outer-west-0'&&u>=2.93-1e-8&&u<=4.195+1e-8&&Math.abs(z-.10)<1e-8?z-.045:z);");
  manor = replace(manor, 'const fa=corners.map(([u,v])=>pt(u,y+v,side*.165)),fb=corners.map(([u,v])=>pt(u,y+v,side*.11));',
    "const inset=id==='outer-west-0'&&i===3&&side===1?.045:0; if(inset&&Math.abs(lo-2.93)+Math.abs(hi-4.195)>1e-7)throw new Error('Hall flush brace bay changed'); const fa=corners.map(([u,v])=>pt(u,y+v,side*.165-inset)),fb=corners.map(([u,v])=>pt(u,y+v,side*.11-inset));");
  manor = replace(manor, 'origin:pt(lo,y+h0,side*.1375)', 'origin:pt(lo,y+h0,side*.1375-inset)');
  manor = replace(manor, 'pt(u,y+v,side*.167)', 'pt(u,y+v,side*.167-inset)');
  manor = replace(manor, "box(o.id+'-sill-lip',[o.w+.28,.06,.30],pt(o.at,bottom-.07),'oak',r);",
    "const flushSill=o.id==='ww-a-0'||o.id==='ww-b-0'; box(o.id+'-sill-lip',[o.w+.28,.06,flushSill?.27:.30],pt(o.at,bottom-.07,flushSill?-.015:0),'oak',r);");
  // Keep the west feet inside the woven base rather than resting partly on
  // the raised selvedge. Preserve part identities while narrowing the frame.
  craft = replace(craft, 'lz=Math.max(.065,width/2-.055),leg=.075;',
    "lz=Math.max(.065,width/2-(id==='hall-bench-west'?.075:.055)),leg=.075,railId=dz=>id==='hall-bench-west'?Math.sign(dz)*Math.max(.065,width/2-.055):dz;");
  craft = replace(craft, "id+'-leg-'+dx+'-'+dz,[leg,.405,leg]", "id+'-leg-'+dx+'-'+railId(dz),[leg,.405,leg]");
  craft = replace(craft, "id+'-seat-rail-'+dz,[2*lx,.07,.05]", "id+'-seat-rail-'+railId(dz),[2*lx,.07,.05]");
  const recipes = { manor, craft };
  const candidate = { manor: sha(manor), craft: sha(craft) };
  const data = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
  manor = manor.replace("'./manor-craft.js'", JSON.stringify(data(craft)));
  for (const path of ['./manor-garden.js', '../materials/manor.js'])
    manor = manor.replace(JSON.stringify(path).replaceAll('"', "'"), JSON.stringify(new URL('../src/models/' + path, import.meta.url).href));
  for (const name of ['three', '@automovie/viewer', '@automovie/engine'])
    manor = manor.replace("'" + name + "'", JSON.stringify(import.meta.resolve(name)));
  const source = (await import(data(manor))).createManorScene({ shadows: false });
  source.scene.updateMatrixWorld(true);
  return { source, basis, candidate, recipes };
}
