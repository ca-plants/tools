import { csvFormat, dsvFormat } from "d3-dsv";
import { Files } from "@ca-plant-list/ca-plant-list";

class INatObs {

    static #api_key;

    static async retrieve( toolsDataDir ) {

        const outputDir = toolsDataDir + "/observations/inat";
        Files.mkdir( outputDir );

        // Read the config file and retrieve each set.
        const data = Files.read( "./data/mapconfig/obs-inat.json" );
        const observationSets = JSON.parse( data );

        const untrustingUsers = {};
        const untrustedObservations = {};

        for ( const observationSet of observationSets ) {
            await this.#retrieveSet( outputDir, observationSet, untrustingUsers, untrustedObservations );
        }

        const sortedUsers = Object.values( untrustingUsers ).sort( ( a, b ) => b.count - a.count );
        Files.write( outputDir + "/data-users.csv", csvFormat( sortedUsers ), true );

        const sortedObs = Object.values( untrustedObservations ).sort( ( a, b ) => b.numUntrusted - a.numUntrusted );
        Files.write( outputDir + "/data-taxa.csv", csvFormat( sortedObs ), true );

    }

    static async #retrieveSet( outputDir, config, untrustingUsers, untrustedObservations ) {

        async function loadPage( page, numPages ) {

            console.log( "loading page " + page + ( numPages ? ( " of " + numPages ) : "" ) );

            url.searchParams.set( "page", page );
            const data = await INatObs.#getData( url );

            for ( const result of data.results ) {

                const obscured = result.obscured;

                const login = result.user.login;
                const userName = result.user.name;
                const taxonName = result.taxon.name;
                const obsDate = result.observed_on_details.date;

                if ( obscured && !result.private_geojson ) {
                    // Coordinates are obscured, ignore.

                    let userInfo = untrustingUsers[ login ];
                    if ( !userInfo ) {
                        userInfo = { login: login, name: userName ? userName : login, count: 0, lastObsDate: obsDate };
                        untrustingUsers[ login ] = userInfo;
                    }
                    userInfo.count++;
                    if ( obsDate > userInfo.lastObsDate ) {
                        userInfo.lastObsDate = obsDate;
                    }

                    let taxonInfo = untrustedObservations[ taxonName ];
                    if ( !taxonInfo ) {
                        taxonInfo = { taxon: taxonName, numUntrusted: 0 };
                        untrustedObservations[ taxonName ] = taxonInfo;
                    }
                    taxonInfo.numUntrusted++;

                    continue;
                }

                const privateLongLat = result.private_geojson ? result.private_geojson.coordinates : [];
                const taxonGeoPrivacy = result.taxon_geoprivacy;
                const obsID = result.id;
                const positionalAccuracy = result.positional_accuracy;
                const publicPositionalAccuracy = result.public_positional_accuracy;
                const description = result.description;
                const longLat = result.geojson ? result.geojson.coordinates : [];
                const geoprivacy = result.geoprivacy;

                outputRows.push(
                    [
                        taxonName,
                        obsDate,
                        privateLongLat[ 1 ],
                        privateLongLat[ 0 ],
                        longLat[ 1 ],
                        longLat[ 0 ],
                        positionalAccuracy,
                        publicPositionalAccuracy,
                        obscured,
                        geoprivacy,
                        taxonGeoPrivacy,
                        login,
                        userName,
                        obsID,
                        result.updated_at,
                        result.license_code,
                        result.taxon.id,
                        description
                    ]
                );

            }

            return data;
        }

        const userData = await this.#getData( "https://api.inaturalist.org/v1/users/me" );
        console.log( "retrieving data as " + userData.results[ 0 ].login );

        const url = new URL( "https://api.inaturalist.org/v1/observations" );
        url.searchParams.set( "project_id", config.project_id );
        url.searchParams.set( "list_id", config.list_id );
        url.searchParams.set( "acc_below_or_unknown", "101" );
        url.searchParams.set( "per_page", 200 );

        const outputRows = [
            [
                "scientific_name",
                "observed_on",
                "private_latitude",
                "private_longitude",
                "latitude",
                "longitude",
                "positional_accuracy",
                "public_positional_accuracy",
                "coordinates_obscured",
                "geoprivacy",
                "taxon_geoprivacy",
                "user_login",
                "user_name",
                "id",
                "updated_at",
                "license_code",
                "taxon_id",
                "description"
            ]
        ];

        const data = await loadPage( 1 );

        const numResults = Math.min( data.total_results, 10000 );
        if ( data.total_results > 10000 ) {
            console.log( data.total_results + " total results, retrieving 10,000" );
        }
        const numPages = Math.ceil( numResults / data.per_page );

        for ( let pageNum = 2; pageNum <= numPages; pageNum++ ) {
            await loadPage( pageNum, numPages );
        }

        const csv = dsvFormat( "," ).formatRows( outputRows );
        Files.write( outputDir + "/obs-" + config.filename + ".csv", csv, true );
    }

    static #getApiKey() {
        if ( !this.#api_key ) {
            const str = Files.read( "./auth/inat.json" );
            const json = JSON.parse( str );
            this.#api_key = json.api_key;
        }
        return this.#api_key;
    }

    static async #getData( url ) {

        const headers = {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: this.#getApiKey()
            }
        };
        const response = await fetch( url, headers );
        if ( response.status !== 200 ) {
            throw new Error( url + " got response " + response.status );
        }
        const data = await response.json();
        return data;
    }
}

export { INatObs };