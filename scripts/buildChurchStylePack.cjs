const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');
const yazl = require('yazl');
const filename = path.resolve('src/types/ChurchStylePack.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = new Module(filename, module); mod._compile(compiled, filename);
const { validateChurchStylePack, churchBackgroundSvg } = mod.exports;
const pack = validateChurchStylePack(JSON.parse(fs.readFileSync(`${process.argv[2] || 'packages/sangstund'}/manifest.json`, 'utf8')));
const zip = new yazl.ZipFile();
fs.mkdirSync(`${process.argv[2] || 'packages/sangstund'}/backgrounds`, { recursive: true });
zip.addFile(`${process.argv[2] || 'packages/sangstund'}/manifest.json`, 'manifest.json');
for (const bg of pack.backgrounds) {
 const svg = churchBackgroundSvg(bg);
 fs.writeFileSync(`${process.argv[2] || 'packages/sangstund'}/backgrounds/${bg.id}.svg`, svg);
 zip.addBuffer(Buffer.from(svg), `backgrounds/${bg.id}.svg`);
}
const guide = 'SÅNGSTUND – CHURCH SHOW PRO 2\n\nInstallera ZIP-filen via Arkiv > Importera > Gemensam import.\nBakgrunder: Media > Sångstund. Sångmallar: Templates > Sång.\nProgramteman: Inställningar > Tema. Välj önskat tema efter installation.\n\nBakgrunder i SVG (3840 × 2160) och matchande sångmallar. Titel och sångnummer ligger nederst, med upphovsuppgifter under. Fyll i sångens metadata för korrekta uppgifter.\nDen gamla provversionen från 13 november saknar denna nya paketadapter.\nAnvänd Church Show Pro 2 version 2.0.6 eller senare.\n\nGemensamt format churchshow-style-pack v1. Mobilappar behöver en adapter\nför samma format; mobilstöd är inte implementerat i detta paket.\nInga personliga filer, fotografier eller externa resurser ingår.\n';
zip.addBuffer(Buffer.from(guide), 'README.txt');
const output = fs.createWriteStream(process.argv[3] || 'packages/Church-Show-Sangstund-1.zip');
zip.outputStream.pipe(output);zip.end();
output.on('close', () => console.log('Created packages/Church-Show-Sangstund-1.zip'));
