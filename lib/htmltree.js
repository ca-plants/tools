import { Files } from "@ca-plant-list/ca-plant-list";
import { parse } from "parse5";

class HTMLTree {

    static getAttr( tree, attName ) {
        if ( !tree.attrs ) {
            return;
        }
        for ( const attr of tree.attrs ) {
            if ( attr.name === attName ) {
                return attr.value;
            }
        }
    }

    /**
     * Retrieve the href and link text from a link element.
     * @param {Object} link 
     * @returns {Object} An Object with "href" and "text" properties.
     */
    static getLinkData( link ) {
        const data = {};
        data.href = HTMLTree.getAttr( link, "href" );
        data.text = link.childNodes[ 0 ].value;
        return data;
    }

    static getSubTree( tree, isMatch ) {
        if ( isMatch( tree ) ) {
            return tree;
        }
        if ( !tree.childNodes ) {
            return;
        }
        for ( const subTree of tree.childNodes ) {
            const t = this.getSubTree( subTree, isMatch );
            if ( t ) {
                return t;
            }
        }
    }

    // Return all matching subtrees.
    static getSubTrees( tree, isMatch ) {
        if ( isMatch( tree ) ) {
            return [ tree ];
        }
        if ( !tree.childNodes ) {
            return;
        }
        const all = [];
        for ( const subTree of tree.childNodes ) {
            const subTrees = this.getSubTrees( subTree, isMatch );
            if ( subTrees ) {
                all.push( ...subTrees );
            }
        }
        return all;
    }

    static getTextContent( node ) {
        if ( !node ) {
            return;
        }
        if ( node.nodeName === "#text" ) {
            return node.value;
        }
        // Otherwise concatenate text from children.
        const text = [];
        for ( const child of node.childNodes ) {
            const t = this.getTextContent( child );
            if ( t ) {
                text.push( t );
            }
        }
        return text.join( " " );
    }

    static getTreeFromFile( fileName ) {
        return parse( Files.read( fileName ) );
    }

}

export { HTMLTree };