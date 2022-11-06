import commandLineArgs from "command-line-args";
import { RPI } from "./rpi.js";
import { INat } from "./inat.js";
import { LogMessage } from "./logmessage.js";
import { Calflora } from "./calflora.js";

const OPTION_DEFS = [
    { name: "data", type: String, defaultValue: "./data" },
    { name: "data-inat-taxa", type: String, defaultValue: "inat_taxa.csv" },
    { name: "tool", type: String },
    { name: "retrieve-tool-data", type: Boolean, defaultValue: false },
];

class Tools {

    static getCommandLineOptions( optionDefs ) {
        return commandLineArgs( optionDefs.concat( OPTION_DEFS ) );
    }

    static async run( options, Taxa ) {

        const retrieveToolData = options[ "retrieve-tool-data" ];

        switch ( options.tool ) {
            case "calflora":
                await Calflora.analyze( Taxa, retrieveToolData );
                break;
            case "inat":
                await INat.analyze( options[ "data-inat-taxa" ], Taxa );
                break;
            case "rpi":
                RPI.analyze();
                break;
            default:
                throw new Error( "unrecognized tool: " + options.data );
        }

        LogMessage.write( "./external_data/log.tsv" );
    }

}

export { Tools };