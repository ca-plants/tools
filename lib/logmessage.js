import * as fs from "node:fs";

class LogMessage {

    static #messages = [];

    static log( ...args ) {
        console.log( args.join( " " ) );
        this.#messages.push( args.join( "\t" ) );
    }

    static write( fileName ) {
        fs.writeFileSync( fileName, this.#messages.join( "\n" ) );
    }

}

export { LogMessage };