import { log } from 'node:console'

process.noDeprecation = true
log(process.argv)

const headless = process.argv.includes('headless') || process.argv.includes('H');
let InterfacePromise

if(headless) {
  InterfacePromise = import("./headlessInterface.mjs")
} else {
  InterfacePromise = import("./graphicalInterface.cjs")
}

await InterfacePromise