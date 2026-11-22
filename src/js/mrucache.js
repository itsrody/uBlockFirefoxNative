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

export class MRUCache {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.map = new Map();
        this.resetTime = Date.now();
    }
    // Map insertion order is the MRU order: head is least recently used,
    // tail is most recently used. Re-inserting a key moves it to the tail
    // without a parallel array or index/splice work.
    add(key, value) {
        if ( this.map.has(key) ) {
            this.map.set(key, value);
            return;
        }
        if ( this.map.size === this.maxSize ) {
            this.map.delete(this.map.keys().next().value);
        }
        this.map.set(key, value);
    }
    remove(key) {
        this.map.delete(key);
    }
    lookup(key) {
        const value = this.map.get(key);
        if ( value === undefined ) { return; }
        this.map.delete(key);
        this.map.set(key, value);
        return value;
    }
    reset() {
        this.map.clear();
        this.resetTime = Date.now();
    }
}
