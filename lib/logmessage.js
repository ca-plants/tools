class LogMessage {

    static log( ...args ) {
        console.log( args.join( " " ) );
    }
}

export { LogMessage };