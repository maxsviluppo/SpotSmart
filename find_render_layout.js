const fs = require('fs');
const content = fs.readFileSync('src/components/SpotSmartApp.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== render / UI layout in SpotSmartApp ===");
let count = 0;
lines.forEach((line, i) => {
  if (line.includes('return (') && i > 1200 && count < 80) {
    count = 80;
    for (let j = i; j < i + 150; j++) {
      console.log(`${j + 1}: ${lines[j]}`);
    }
  }
});
