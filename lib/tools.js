import commandLineArgs from "command-line-args";
import { RPI } from "./rpi.js";
import { INat } from "./inat.js";
import { LogMessage } from "./logmessage.js";
import { Calflora } from "./calflora.js";
import { Jepson } from "./jepson.js";

const OPTION_DEFS = [
    { name: "data", type: String, defaultValue: "./data" },
    { name: "data-inat-taxa", type: String, defaultValue: "inat_taxa.csv" },
    { name: "tool", type: String, multiple: true },
];

const TOOLS_DATA_DIR = "./external_data";

const TOOLS = {
    CALFLORA: "calflora",
    INAT: "inat",
    JEPSON: "jepson",
    RPI: "rpi",
    RPISCRAPE: "rpi-scrape",
};

class Tools {

    static getCommandLineOptions( optionDefs ) {
        return commandLineArgs( optionDefs.concat( OPTION_DEFS ) );
    }

    static async run( options, Taxa ) {

        let tools = options.tool;
        if ( tools[ 0 ] === "all" ) {
            tools = Object.values( TOOLS );
        }

        for ( const tool of tools ) {
            switch ( tool ) {
                case TOOLS.CALFLORA:
                    await Calflora.analyze( TOOLS_DATA_DIR, Taxa );
                    break;
                case TOOLS.INAT:
                    await INat.analyze( TOOLS_DATA_DIR, Taxa, options[ "data-inat-taxa" ] );
                    break;
                case TOOLS.JEPSON:
                    await Jepson.analyze( TOOLS_DATA_DIR, Taxa );
                    break;
                case TOOLS.RPI:
                    await RPI.analyze( TOOLS_DATA_DIR, Taxa );
                    break;
                case TOOLS.RPISCRAPE:
                    await RPI.scrape( TOOLS_DATA_DIR, Taxa );
                    break;
                default:
                    throw new Error( "unrecognized tool: " + options.data );
            }
        }

        LogMessage.write( "./external_data/log.tsv" );
    }

}

export { Tools };