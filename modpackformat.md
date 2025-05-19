- descriptor
	- defaultConfig
	- defaultChange
- version
- changelist

If someone wants to install your modpack from the web, they will need to provide the URL of the modpack descriptor. The contents of the descriptor are formatted as follows:
```
defaultConfig => https://www.example.com/modpack0/defaultConfig
defaultChange => 0.0.0 -> 1.0.0
```
The default config is a base `packConfig`, which will be downloaded for the user to modify. The default change is a changeset which should be within your changelist, likely as the first entry. The use of a changeset rather than direct archive download means you can utilize the basic scripting capacities of the changesets to prompt users about their download. (i.e. texture quality, visual extras, configuration details, etc.)

The following is the command list for the install script
```
import
config
set
read
write
jump
await
prompt
display
comment
log
warn
error
download
decompress
delete
move
splice
regex
```

File locations:
```
$D : Downloads
$I : Game Instance
$G : Game Install
$A : Game Appdata
$S : Synchrony Pack
```