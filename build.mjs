import { build } from 'esbuild';
import fs from 'node:fs';
const result=await build({entryPoints:['src/main.js'],bundle:true,write:false,format:'iife',target:['es2020'],minify:true,legalComments:'inline'});
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const license=fs.readFileSync('node_modules/three/LICENSE','utf8');
const shell=fs.readFileSync('src/shell.html','utf8').replace('</head>',`<!-- Three.js license\n${license}\n-->\n</head>`);
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/index.html',shell.replace('<!-- INLINE_APP -->',()=>`<script>${js}</script>`));
console.log('Built standalone HTML:',fs.statSync('dist/index.html').size,'bytes');
