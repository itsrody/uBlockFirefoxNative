/*******************************************************************************

    uBlock Origin - a comprehensive, efficient content blocker
    Copyright (C) 2014-present Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

/******************************************************************************/

import { orphanizeString } from './text-utils.js';

/******************************************************************************/

export const parseExpires = s => {
    const matches = s.match(/(\d+)\s*([wdhm]?)/i);
    if ( matches === null ) { return; }
    let updateAfter = parseInt(matches[1], 10);
    if ( updateAfter === 0 ) { return; }
    if ( matches[2] === 'w' ) {
        updateAfter *= 7 * 24;
    } else if ( matches[2] === 'h' ) {
        updateAfter = Math.max(updateAfter, 4) / 24;
    } else if ( matches[2] === 'm' ) {
        updateAfter = Math.max(updateAfter, 240) / 1440;
    }
    return updateAfter;
};

export const extractMetadataFromList = (content, fields) => {
    const out = {};
    const head = content.slice(0, 1024);
    fields.forEach(rawField => {
        const field = rawField.replace(/\s+/g, '-');
        const re = new RegExp(`^(?:! *|# +)${field.replace(/-/g, '(?: +|-)')}: *(.+)$`, 'im');
        const match = re.exec(head);
        let value = match && match[1].trim() || undefined;
        if ( value !== undefined && value.startsWith('%') ) {
            value = undefined;
        }
        out[field.toLowerCase().replace(
            /-[a-z]/g, s => s.charAt(1).toUpperCase()
        )] = value && orphanizeString(value);
    });
    // Pre-process known fields
    if ( out.lastModified ) {
        out.lastModified = (new Date(out.lastModified)).getTime() || 0;
    }
    if ( out.expires ) {
        out.expires = parseExpires(out.expires);
    }
    if ( out.diffExpires ) {
        out.diffExpires = parseExpires(out.diffExpires);
    }
    return out;
};

export const resourceTimeFromXhr = xhr => {
    if ( typeof xhr.response !== 'string' ) {  return 0; }
    const metadata = extractMetadataFromList(xhr.response, [
        'Last-Modified'
    ]);
    return metadata.lastModified || 0;
};

export const isDiffUpdatableAsset = content => {
    if ( typeof content !== 'string' ) { return false; }
    const data = extractMetadataFromList(content, [
        'Diff-Path',
    ]);
    return typeof data.diffPath === 'string' &&
        data.diffPath.startsWith('%') === false;
};
