# Synchrony: A Simple Modpack Sync Application
## Install & Use
Currently you must build the application yourself. Builds will be attached to future Beta releases

## Contributing
To get started you will need to have installed:
* NPM / NodeJS 
* Editor of choice (VScode build and launch configs are included in the repo)
* Node dependencies, install with these commands:
```shell
npm install --save-dev electron@35.0.0
npm install --save-dev electron/fuses@35.0.0
npm install --save-dev electron-forge/cli@7.7.0
npm install --save-dev electron-forge/maker-deb@7.7.0
npm install --save-dev electron-forge/maker-rpm@7.7.0
npm install --save-dev electron-forge/maker-squirrel@7.7.0
npm install --save-dev electron-forge/maker-zip@7.7.0
npm install --save-dev electron-forge/plugin-auto-unpack-natives@7.7.0
npm install --save-dev electron-forge/plugin-fuses@7.7.0
npm install --save-dev electron-winstaller
npm install node-downloader-helper@2.1.9
```
If you are using VScode, the launch config should allow you to immediately use the run & debug shortcuts (Ctrl+F5 / F5)

## I Was Too Lazy To Setup A Kanban Board

TODO:
- Modpack config buttons
- Change processing
- UI prompts
- Synchrony auto-update
- Synchrony config

Backlog:
- In-app config for modpack and synchrony
- Support for multi-directory installation
- Command-line version check support to enable modpacks to check their own version