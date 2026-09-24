import { readFileSync, writeFileSync } from "node:fs";

const newName = process.argv[2];
if (!newName) {
  console.error("Error: New name argument is required.");
  process.exit(1);
}

const pkgPath = "package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = newName;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`package.json name changed to "${newName}"`);
