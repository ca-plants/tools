import { Files } from "@ca-plant-list/ca-plant-list";
import { dsvFormat } from "d3-dsv";

class INatObs {

    static #api_key;

    static async retrieve( toolsDataDir ) {

        const userData = await this.#getData( "https://api.inaturalist.org/v1/users/me" );
        console.log( "retrieving data as " + userData.results[ 0 ].login );

        const page = 1;

        const url = new URL( "https://api.inaturalist.org/v1/observations?project_id=ebcnps" );
        url.searchParams.set( "list_id", "4381953" );
        url.searchParams.set( "acc_below_or_unknown", "101" );
        url.searchParams.set( "per_page", 200 );
        url.searchParams.set( "page", page );
        const data = await this.#getData( url );

        console.log( data.total_results )
        console.log( data.per_page )
        console.log( data.page )
        console.log( "pages: " + Math.ceil( data.total_results / data.per_page ) )

        const colHeaders =
            [
                "taxon",
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
                "description"
            ];

        const outputRows = [];
        for ( const result of data.results ) {

            const obscured = result.obscured;

            if ( obscured && !result.private_geojson ) {
                // Coordinates are obscured, ignore.
                continue;
            }

            const privateLongLat = result.private_geojson ? result.private_geojson.coordinates : [ "", "" ];
            const taxonGeoPrivacy = result.taxon_geoprivacy;
            const obsDate = result.observed_on_details.date;
            const obsID = result.id;
            const positionalAccuracy = result.positional_accuracy;
            const publicPositionalAccuracy = result.public_positional_accuracy;
            const description = result.description;
            const taxonName = result.taxon.name;
            const longLat = result.geojson.coordinates;
            const geoprivacy = result.geoprivacy;
            const login = result.user.login;
            const userName = result.user.name;

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
                    description
                ]
            );
        }

        const outputDir = toolsDataDir + "/observations/inat";
        Files.mkdir( outputDir );
        const csv = dsvFormat( "," ).formatRows( outputRows, colHeaders );
        Files.write( outputDir + "/inato.csv", csv, true );
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
        const data = await response.json();
        return data;
    }
}

export { INatObs };