import fs from "fs"
import { parseFile } from "music-metadata"
import sharp from "sharp"
import ColorTheif from "colorthief"
import NowPlaying from "./classes/NowPlayingFS.mjs";

var ROOT = "";
/**
 * File path of the now playing JSON file (default: "./foo_now_playing.json").
 */
const PATH = "foo_now_playing.json";

class Config {
    setAllValues(export_root, canRun, isRunning) {
        this.export_root = export_root;
        this.canRun = canRun;
        this.isRunning = isRunning;
    }
    parseJSON(data){
        this.canRun = data.canRun;
        this.export_root = data.export_root;
        this.isRunning = data.isRunning;
    }
}
``
const CONFIG_PATH = "./config/config.json";

const CONFIG = new Config();

/**
 * Command Line Syntax for colors
 */
const COLORS = {
    Green:  "\x1b[32m",
    Black: "\x1b[30m",
    Red: "\x1b[31m",
    Green: "\x1b[32m",
    Yellow: "\x1b[33m",
    Blue: "\x1b[34m",
    Magenta: "\x1b[35m",
    Cyan: "\x1b[36m",
    White: "\x1b[37m",
    Gray: "\x1b[90m"
}

/**
 * Duration in miliseconds to wait after an error occurs
 */
const exitTime = 3000;

/**
 * Object of the last playing track
 */
const lastPLaying =  new NowPlaying();
/**
 * Object of the current playing track
 */
const nowPlaying =  new NowPlaying();

var debug = false;

const args = process.argv.slice(2);
CONFIG.parseJSON(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")));
if(args.length == 0){
    console.log("No arguments passed, continuing as usual");
}
else if (args.includes('/stop')) {
    console.log(COLORS.Green+"Stopping application");
    CONFIG.canRun = false;
    CONFIG.isRunning = false;
    fs.writeFileSync(CONFIG_PATH,JSON.stringify(CONFIG), "utf-8")
    exitNoWait(1)
}
else if(args.includes('/debug')){
    console.log(COLORS.Green+"Debug mode enabled");
    debug = true;
}
else if(args.includes("/canRun")){
    console.log(CONFIG.canRun)
    exitNoWait(1)
}
else if(args.includes("/status")){
    console.log(CONFIG.isRunning)
    process.exit(1);
}
CONFIG.canRun = true;
CONFIG.isRunning = true;
fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG), "utf-8")

function debugLog(message){
    if(debug){
        console.log(message);
    }
}

/**
 * Wait for a specified amount of time.
 * @param {Number} ms - Miliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * Using the data from the pased audio file, save the cover to the specified path.
 * @param {*} parsedAudioFile - The parsed audio file, there is not an 
 * @returns {Promise<Void>} - Promise of when the cover is saved
 * @see {@link https://www.npmjs.com/package/music-metadata} - Library used to parse audio files
 * @see {@link https://www.npmjs.com/package/sharp} - Library used to convert the file type
 */
async function saveCover(parsedAudioFile){
    var format = (parsedAudioFile.common.picture[0].format).replace("image/", "")
    if(format != "png"){
        parsedAudioFile.common.picture[0].data = await sharp(parsedAudioFile.common.picture[0].data).toFormat("png").toBuffer() 
    }
    fs.writeFile(CONFIG.export_root+"cover.png", parsedAudioFile.common.picture[0].data, function (err) {
        if (err) {
            return console.log(err);
        }
        debugLog(COLORS.Green+"Image file has been saved");
    });
}
/**
 * Get the common color from the saved image file
 * @returns {Promise<Void>} - Promise of when the color is read and saved
 * @see {@link OUTPUT_PATH} - Path for the output image file
 * @see {@link https://www.npmjs.com/package/colorthief} - Library used to get the color from the image file
 */
async function getCommonColorV2(){
    let color;
    await sleep(250);
    try{
        color = await ColorTheif.getColor(CONFIG.export_root+"cover.png");
    } catch {
        console.log("Error getting color")
        return;
    }

    let rgb = {
        r: color[0],
        g: color[1],
        b: color[2]
    }
    debugLog(rgb)
    // TODO: Change to async method
    fs.writeFile(CONFIG.export_root+"color.json", JSON.stringify(rgb), function (err) {
        if (err) {
            return console.log(err);
        }
        debugLog(COLORS.Green + "Color JSON has been saved")
    });
}
/**
 * Main loop for the application
 * - Handles the logic for when the now playing JSON file is updated
 * - Exists under the following conditions
 * - The JSON file is not found
 * - The JSON file is not valid JSON
 * @see {@link NowPlaying.updateFromJSON} - update the now player object
 * @see {@link sleep} - Sleep for a specific amount of time
 * @see {@link getCommonColorV2} - Get the common color from the saved image file
 * @see {@link https://www.npmjs.com/package/music-metadata} - Library used to parse audio files
*/
async function main() {
    fs.existsSync(CONFIG_PATH) ? debugLog(COLORS.Green+"Config file found") : debugLog(COLORS.Red+"Config file not found");
    CONFIG.parseJSON(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")));
    if(!fs.existsSync(CONFIG.export_root+PATH)){
        console.log(COLORS.Red+"No JSON file found")
        console.log(COLORS.Yellow+`Please make sure you have a JSON file named ${CONFIG.export_root+PATH.replace("./","")} in the root of the parent directory of this project`)
        await exit(1);
    }
    let error = await nowPlaying.updateFromJSON(CONFIG.export_root+PATH);
    debugLog(nowPlaying)
    if(error){
        console.log(COLORS.Red+"Invalid JSON format");
        console.log(COLORS.Yellow+`Please make sure the JSON file is valid based on the read me template`);
        console.log(COLORS.Yellow+"Please check that Foobar2000 is running")
        console.log(`${error}`)
        await exit(1);
    }
    if(nowPlaying.playing == 0){
        console.log("No song playing")
    }
    console.log(COLORS.Green+"Connected!")
    while(true){
        await sleep(1000);
        await nowPlaying.updateFromJSON(CONFIG.export_root+PATH)
        CONFIG.parseJSON(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")));
        debugLog(CONFIG)
        if(CONFIG.canRun == false){
            console.log(COLORS.Yellow+"Please make sure the file at canRun file is set to true if this was not expected")
            await exit(1)
        }
        if(nowPlaying.title == lastPLaying.title || nowPlaying.playing == 0){
    
        } else {
            console.log(COLORS.Green+"Now Playing: "+nowPlaying.title)
            let file;
            try{
                file = await parseFile(nowPlaying.path)
            } catch {
                file = null;
            }
            if(file != null)  await saveCover(file)
            await getCommonColorV2()
        }
        lastPLaying.setNowPlaying(nowPlaying)
    }
}

async function exit(code) {
    console.log(COLORS.Red+"Exiting Application in "+exitTime/1000+"s");
    await sleep(exitTime)
    onExit(code)
}
function exitNoWait(code) {
    console.log(COLORS.Red+"Exiting Application");
    onExit(code)
}

function onExit(code){
    CONFIG.isRunning = false;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG), "utf-8")
    process.exit(code)
}

main();


