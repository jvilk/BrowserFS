var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var kvfs = require('../generic/key_value_filesystem');
var InMemoryStore = (function () {
    function InMemoryStore() {
        this.store = {};
    }
    InMemoryStore.prototype.name = function () { return 'In-memory'; };
    InMemoryStore.prototype.clear = function () { this.store = {}; };
    InMemoryStore.prototype.beginTransaction = function (type) {
        return new kvfs.SimpleSyncRWTransaction(this);
    };
    InMemoryStore.prototype.get = function (key) {
        return this.store[key];
    };
    InMemoryStore.prototype.put = function (key, data, overwrite) {
        if (!overwrite && this.store.hasOwnProperty(key)) {
            return false;
        }
        this.store[key] = data;
        return true;
    };
    InMemoryStore.prototype.del = function (key) {
        delete this.store[key];
    };
    return InMemoryStore;
})();
exports.InMemoryStore = InMemoryStore;
var InMemoryFileSystem = (function (_super) {
    __extends(InMemoryFileSystem, _super);
    function InMemoryFileSystem() {
        _super.call(this, { store: new InMemoryStore() });
    }
    return InMemoryFileSystem;
})(kvfs.SyncKeyValueFileSystem);
exports.__esModule = true;
exports["default"] = InMemoryFileSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW5NZW1vcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYmFja2VuZC9Jbk1lbW9yeS50cyJdLCJuYW1lcyI6WyJJbk1lbW9yeVN0b3JlIiwiSW5NZW1vcnlTdG9yZS5jb25zdHJ1Y3RvciIsIkluTWVtb3J5U3RvcmUubmFtZSIsIkluTWVtb3J5U3RvcmUuY2xlYXIiLCJJbk1lbW9yeVN0b3JlLmJlZ2luVHJhbnNhY3Rpb24iLCJJbk1lbW9yeVN0b3JlLmdldCIsIkluTWVtb3J5U3RvcmUucHV0IiwiSW5NZW1vcnlTdG9yZS5kZWwiLCJJbk1lbW9yeUZpbGVTeXN0ZW0iLCJJbk1lbW9yeUZpbGVTeXN0ZW0uY29uc3RydWN0b3IiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsSUFBTyxJQUFJLFdBQVcsaUNBQWlDLENBQUMsQ0FBQztBQUt6RDtJQUFBQTtRQUNVQyxVQUFLQSxHQUFrQ0EsRUFBRUEsQ0FBQ0E7SUF3QnBEQSxDQUFDQTtJQXRCUUQsNEJBQUlBLEdBQVhBLGNBQWdCRSxNQUFNQSxDQUFDQSxXQUFXQSxDQUFDQSxDQUFDQSxDQUFDQTtJQUM5QkYsNkJBQUtBLEdBQVpBLGNBQWlCRyxJQUFJQSxDQUFDQSxLQUFLQSxHQUFHQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQTtJQUU1Qkgsd0NBQWdCQSxHQUF2QkEsVUFBd0JBLElBQVlBO1FBQ2xDSSxNQUFNQSxDQUFDQSxJQUFJQSxJQUFJQSxDQUFDQSx1QkFBdUJBLENBQUNBLElBQUlBLENBQUNBLENBQUNBO0lBQ2hEQSxDQUFDQTtJQUVNSiwyQkFBR0EsR0FBVkEsVUFBV0EsR0FBV0E7UUFDcEJLLE1BQU1BLENBQUNBLElBQUlBLENBQUNBLEtBQUtBLENBQUNBLEdBQUdBLENBQUNBLENBQUNBO0lBQ3pCQSxDQUFDQTtJQUVNTCwyQkFBR0EsR0FBVkEsVUFBV0EsR0FBV0EsRUFBRUEsSUFBZ0JBLEVBQUVBLFNBQWtCQTtRQUMxRE0sRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsU0FBU0EsSUFBSUEsSUFBSUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsY0FBY0EsQ0FBQ0EsR0FBR0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDakRBLE1BQU1BLENBQUNBLEtBQUtBLENBQUNBO1FBQ2ZBLENBQUNBO1FBQ0RBLElBQUlBLENBQUNBLEtBQUtBLENBQUNBLEdBQUdBLENBQUNBLEdBQUdBLElBQUlBLENBQUNBO1FBQ3ZCQSxNQUFNQSxDQUFDQSxJQUFJQSxDQUFDQTtJQUNkQSxDQUFDQTtJQUVNTiwyQkFBR0EsR0FBVkEsVUFBV0EsR0FBV0E7UUFDcEJPLE9BQU9BLElBQUlBLENBQUNBLEtBQUtBLENBQUNBLEdBQUdBLENBQUNBLENBQUNBO0lBQ3pCQSxDQUFDQTtJQUNIUCxvQkFBQ0E7QUFBREEsQ0FBQ0EsQUF6QkQsSUF5QkM7QUF6QlkscUJBQWEsZ0JBeUJ6QixDQUFBO0FBS0Q7SUFBZ0RRLHNDQUEyQkE7SUFDekVBO1FBQ0VDLGtCQUFNQSxFQUFFQSxLQUFLQSxFQUFFQSxJQUFJQSxhQUFhQSxFQUFFQSxFQUFFQSxDQUFDQSxDQUFDQTtJQUN4Q0EsQ0FBQ0E7SUFDSEQseUJBQUNBO0FBQURBLENBQUNBLEFBSkQsRUFBZ0QsSUFBSSxDQUFDLHNCQUFzQixFQUkxRTtBQUpEO3VDQUlDLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQga3ZmcyA9IHJlcXVpcmUoJy4uL2dlbmVyaWMva2V5X3ZhbHVlX2ZpbGVzeXN0ZW0nKTtcblxuLyoqXG4gKiBBIHNpbXBsZSBpbi1tZW1vcnkga2V5LXZhbHVlIHN0b3JlIGJhY2tlZCBieSBhIEphdmFTY3JpcHQgb2JqZWN0LlxuICovXG5leHBvcnQgY2xhc3MgSW5NZW1vcnlTdG9yZSBpbXBsZW1lbnRzIGt2ZnMuU3luY0tleVZhbHVlU3RvcmUsIGt2ZnMuU2ltcGxlU3luY1N0b3JlIHtcbiAgcHJpdmF0ZSBzdG9yZTogeyBba2V5OiBzdHJpbmddOiBOb2RlQnVmZmVyIH0gPSB7fTtcblxuICBwdWJsaWMgbmFtZSgpIHsgcmV0dXJuICdJbi1tZW1vcnknOyB9XG4gIHB1YmxpYyBjbGVhcigpIHsgdGhpcy5zdG9yZSA9IHt9OyB9XG5cbiAgcHVibGljIGJlZ2luVHJhbnNhY3Rpb24odHlwZTogc3RyaW5nKToga3Zmcy5TeW5jS2V5VmFsdWVSV1RyYW5zYWN0aW9uIHtcbiAgICByZXR1cm4gbmV3IGt2ZnMuU2ltcGxlU3luY1JXVHJhbnNhY3Rpb24odGhpcyk7XG4gIH1cblxuICBwdWJsaWMgZ2V0KGtleTogc3RyaW5nKTogTm9kZUJ1ZmZlciB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcmVba2V5XTtcbiAgfVxuXG4gIHB1YmxpYyBwdXQoa2V5OiBzdHJpbmcsIGRhdGE6IE5vZGVCdWZmZXIsIG92ZXJ3cml0ZTogYm9vbGVhbik6IGJvb2xlYW4ge1xuICAgIGlmICghb3ZlcndyaXRlICYmIHRoaXMuc3RvcmUuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLnN0b3JlW2tleV0gPSBkYXRhO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcHVibGljIGRlbChrZXk6IHN0cmluZyk6IHZvaWQge1xuICAgIGRlbGV0ZSB0aGlzLnN0b3JlW2tleV07XG4gIH1cbn1cblxuLyoqXG4gKiBBIHNpbXBsZSBpbi1tZW1vcnkgZmlsZSBzeXN0ZW0gYmFja2VkIGJ5IGFuIEluTWVtb3J5U3RvcmUuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEluTWVtb3J5RmlsZVN5c3RlbSBleHRlbmRzIGt2ZnMuU3luY0tleVZhbHVlRmlsZVN5c3RlbSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKHsgc3RvcmU6IG5ldyBJbk1lbW9yeVN0b3JlKCkgfSk7XG4gIH1cbn1cbiJdfQ==