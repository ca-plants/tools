import { Files } from "@ca-plant-list/ca-plant-list";

class LogMessage {

    static #messages = [];

    constructor() {
        throw new Error();
    }

    static log( ...args ) {
        console.log( args.join( " " ) );
        this.#messages.push( args.join( "\t" ) );
    }

    static write( fileName ) {
        Files.write( fileName, this.#messages.join( "\n" ), true );
    }

}

export { LogMessage };