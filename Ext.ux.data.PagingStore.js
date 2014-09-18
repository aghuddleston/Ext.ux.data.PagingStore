/*
 * PagingStore for Ext 4 - v0.6
 * Based on Ext.ux.data.PagingStore for Ext JS 3, by Condor, found at
 * http://www.sencha.com/forum/showthread.php?71532-Ext.ux.data.PagingStore-v0.5
 * Stores are configured as normal, with whatever proxy you need for remote or local.  Set the
 * lastOptions when defining the store to set start, limit and current page.  Store should only
 * request new data if params or extraParams changes.  In Ext JS 4, start, limit and page are part of the
 * options but no longer part of params.
 * Example remote store:
 *     var myStore = Ext.create('Ext.ux.data.PagingStore', {
         model: 'Artist',
         pageSize: 3,
         lastOptions: {start: 0, limit: 3, page: 1},
         proxy: {
             type: 'ajax',
             url: 'url/goes/here',
             reader: {
                 type: 'json',
                 root: 'rows'
             }
         }
      });

 * Example local store:
 *    var myStore = Ext.create('Ext.ux.data.PagingStore', {
         model: 'Artist',
         pageSize: 3,
         lastOptions: {start: 0, limit: 3, page: 1},
         proxy: {
            type: 'memory',
            reader: 'array'
        },
         data: data
     });
 * To force a reload, delete store.lastParams.
 */
Ext.define('Ext.ux.data.PagingStore', {
    extend: 'Ext.data.Store',
    alias: 'store.pagingstore',

    destroyStore: function () {
        this.callParent(arguments);
        this.allData = null;
    },

    /**
     * Currently, only looking at start, limit, page and params properties of options.  Ignore everything
     * else.
     * @param {Ext.data.Operation} options
     * @return {boolean}
     */
    isPaging: function (options) {
        var me = this,
            start = options.start,
            limit = options.limit,
            page = options.page,
            currentParams;

        if ((typeof start != 'number') || (typeof limit != 'number')) {
            delete me.start;
            delete me.limit;
            delete me.page;
            me.lastParams = options.params;
            return false;
        }

        me.start = start;
        me.limit = limit;
        me.currentPage = page;
        var lastParams = this.lastParams;
        currentParams = Ext.apply({}, options.params, this.proxy ? this.proxy.extraParams : {});
        me.lastParams = currentParams;
        if (!this.proxy) {
            return true;
        }
        // No params from a previous load, must be the first load
        if (!lastParams) {
            return false;
        }

        //Iterate through all of the current parameters, if there are differences, then this is
        //not just a paging request, but instead a true load request
        for (var param in currentParams) {
            if (currentParams.hasOwnProperty(param) && (currentParams[param] !== lastParams[param])) {
                return false;
            }
        }
        //Do the same iteration, but this time walking through the lastParams
        for (param in lastParams) {
            if (lastParams.hasOwnProperty(param) && (currentParams[param] !== lastParams[param])) {
                return false;
            }
        }
        return true;
    },

    applyPaging: function () {
        var me = this,
            start = me.start,
            limit = me.limit,
            allData, data, records, i, stop;

        if ((typeof start == 'number') && (typeof limit == 'number')) {
            allData = me.getData();
            data = new Ext.util.Collection(allData.config);
            stop = start + limit;
            records = allData.getRange(start, stop);
            data.add(records);
            me.allData = allData;
            me.data = data;
        }
    },

    loadRecords: function (records, options) {
        var me = this,
            length = records.length,
            data = me.getData(),
            addRecords, autoSort, skipSort, i,
            allData = me.allData;

        if (options) {
            addRecords = options.addRecords;
        }

        skipSort = me.getRemoteSort() || !me.getSortOnLoad();
        if (skipSort) {
            autoSort = data.getAutoSort();
            data.setAutoSort(false);
        }

        if (!addRecords) {
            delete me.allData;
            me.clearData(true);
        } else if (allData) {
            allData.add(records);
        }

        me.ignoreCollectionAdd = true;
        me.callObservers('BeforeLoad');
        data.add(records);
        me.ignoreCollectionAdd = false;

            if (!me.allData) {
              me.applyPaging();
            }

        for (i = 0; i < length; i++) {
            records[i].join(me);
        }

        if (skipSort) {
            data.setAutoSort(autoSort);
        }
        ++me.loadCount;
        me.complete = true;
        me.fireEvent('datachanged', me);
        me.fireEvent('refresh', me);
        me.callObservers('AfterLoad');
    },

    loadData: function (data, append) {
        var length = data.length,
            newData = [],
            i;

        this.isPaging(Ext.apply({}, this.lastOptions ? this.lastOptions : {}));

        //make sure each data element is an Ext.data.Model instance
        for (i = 0; i < length; i++) {
            newData.push(this.createModel(data[i]));
        }

        this.loadRecords(newData, append ? this.addRecordsOptions : undefined);
    },

    loadRawData: function (data, append) {
        var me = this,
            session = me.getSession(),
            result = me.getProxy().getReader().read(data, session ? {
                recordCreator: session.recordCreator
            } : undefined),
            records = result.getRecords(),
            success = result.getSuccess();

        if (success) {
            me.totalCount = result.getTotal();
            me.isPaging(Ext.apply({}, this.lastOptions ? this.lastOptions : {}));
            me.loadRecords(records, append ? me.addRecordsOptions : undefined);
        }
        return success;
    },

    load: function (options) {
        var me = this,
            pageSize = me.getPageSize(),
            session,
            pagingOptions;

        options = options || {};

        if (typeof options === 'function') {
            options = {
                callback: options
            };
        } else {
            options = Ext.apply({}, options);
        }

        // Only add grouping options if grouping is remote
        if (me.getRemoteSort() && !options.grouper && me.getGrouper()) {
            options.grouper = me.getGrouper();
        }

        if (pageSize || 'start' in options || 'limit' in options || 'page' in options) {
            options.page = options.page || me.currentPage;
            options.start = (options.start !== undefined) ? options.start : (options.page - 1) * pageSize;
            options.limit = options.limit || pageSize;
        }

        options.addRecords = options.addRecords || false;

        if (!options.recordCreator) {
            session = me.getSession();
            if (session) {
                options.recordCreator = session.recordCreator;
            }
        }

        // Prevent loads from being triggered while applying initial configs
        if (this.isLoadBlocked()) {
            return;
        }

        var proxy = me.getProxy(),
            loadTask = me.loadTask,
            operation = {
                internalScope: me,
                internalCallback: me.onProxyLoad
            }, filters, sorters;


        // Only add filtering and sorting options if those options are remote
        if (me.getRemoteFilter()) {
            filters = me.getFilters();
            if (filters.getCount()) {
                operation.filters = filters.getRange();
            }
        }
        if (me.getRemoteSort()) {
            sorters = me.getSorters();
            if (sorters.getCount()) {
                operation.sorters = sorters.getRange();
            }
            me.fireEvent('beforesort', me, operation.sorters);
        }
        Ext.apply(operation, options);
        operation.scope = operation.scope || me;
        me.lastOptions = operation;

        operation = proxy.createOperation('read', operation);

        if (me.fireEvent('beforeload', me, operation) !== false) {
            me.loading = true;
            if (loadTask) {
                loadTask.cancel();
                me.loadTask = null;
            }

            pagingOptions = Ext.apply({}, options);
            if (me.isPaging(pagingOptions)) {
                if (me.allData) {
                    me.data = me.allData;
                    delete me.allData;
                }
                me.applyPaging();
                me.fireEvent('datachanged', me);
                me.fireEvent('refresh', me);
                me.callObservers('AfterLoad');
                me.loading = false;
                if (me.hasListeners.load) {
                    me.fireEvent('load', me, me.getData(), true, operation);
                }
                return me;
            }

            operation.execute();
        }

        return me;
    },

    insert: function (index, records) {
        var me = this,
            len, i;

        if (records) {
            if (!Ext.isIterable(records)) {
                records = [records];
            } else {
                records = Ext.Array.clone(records);
            }
            len = records.length;
        }

        if (!len) {
            return [];
        }

        for (i = 0; i < len; ++i) {
            records[i] = me.createModel(records[i]);
        }

        me.getData().insert(index, records);
        if (me.allData) {
            me.allData.add(records);
        }
        return records;

    },

    sort: function (field, direction, mode) {
        var me = this;

        if (me.allData) {
            me.data = me.allData;
            delete me.allData;
        }

        if (arguments.length === 0) {
            if (me.getRemoteSort()) {
                me.attemptLoad();
            } else {
                me.forceLocalSort();
            }
        } else {
            me.getSorters().addSort(field, direction, mode);
        }
    },

    onSorterEndUpdate: function () {
        var me = this,
            sorters = me.getSorters().getRange();

        if (sorters.length) {
            if (me.getRemoteSort()) {
                me.attemptLoad({
                    callback: function () {
                        me.fireEvent('sort', me, sorters);
                    }
                });
            } else {

                me.applyPaging();
                me.fireEvent('datachanged', me);
                me.fireEvent('refresh', me);
                me.fireEvent('sort', me, sorters);
            }
        }
    },

    onFilterEndUpdate: function () {
        var me = this;
        me.applyPaging();
        me.callParent(arguments);
    },

    getTotalCount: function () {
        return this.allData ? this.allData.getCount() : this.totalCount || 0;
    },

    getUnfiltered: function () {
        var data = this.getData();

        if (this.allData) {
            data = this.allData;
        }

        return data.getSource() || data;
    },

    remove: function (records, /* private */ isMove, silent) {
        var me = this,
            data = me.getData(),
            len, i, toRemove, record;

        if (records) {
            if (records.isModel) {
                if (me.indexOf(records) > -1) {
                    toRemove = [records];
                    len = 1;
                } else {
                    len = 0;
                }
            } else {
                toRemove = [];
                for (i = 0, len = records.length; i < len; ++i) {
                    record = records[i];

                    if (record && record.isEntity) {
                        if (!data.contains(record)) {
                            continue;
                        }
                    } else if (!(record = data.getAt(record))) { // an index
                        continue;
                    }

                    toRemove.push(record);
                }

                len = toRemove.length;
            }
        }

        if (!len) {
            return [];
        }

        me.removeIsMove = isMove === true;
        me.removeIsSilent = silent;
        data.remove(toRemove);
        if (me.allData) {
            me.allData.remove(toRemove);
        }
        me.removeIsSilent = false;
        return toRemove;
    },

    filter: function (filters, value) {
        var me = this;
        if (me.allData) {
            me.data = me.allData;
            delete me.allData;
        }
        me.callParent(arguments);
    },

    clearFilter: function (suppressEvent) {
        var me = this;
        if (me.allData) {
            me.data = me.allData;
            delete me.allData;
        }
        me.callParent(arguments);
    },

    filterBy: function (fn, scope) {
        var me = this;
        if (me.allData) {
            me.data = me.allData;
            delete me.allData;
        }
        me.callParent(arguments);
    },

    resetToAllData: function () {
        var me = this;
        if (me.allData) {
            me.data = me.allData;
            delete me.allData;
        }
    },

    addFilter: function(filters) {
        this.resetToAllData();
        this.callParent(arguments);
    },

    removeFilter: function(filter) {
        this.resetToAllData();
        this.callParent(arguments);
    },

    queryBy: function (fn, scope) {
        var data = this.allData;

        return (data.getSource() || data).createFiltered(fn, scope);
    },

    collect: function (dataIndex, allowNull, bypassFilter) {
        var me = this,
            data = me.getData();

        if (bypassFilter === true && data.filtered) {
            data = me.allData;
            data = data.getSource();
        }

        return data.collect(dataIndex, 'data', allowNull);
    },

    getById: function (id) {
        var data = this.allData;

        if (data.filtered) {
            data = data.getSource();
        }
        return data.get(id) || null;
    },

    removeAll: function (silent) {
        var me = this,
            data = me.getData(),
            hasClear = me.hasListeners.clear,
            records = data.getRange();

        // We want to remove and mute any events here
        if (data.length) {
            // Explicit true here, we never want to fire remove events
            me.removeIsSilent = true;
            me.callObservers('BeforeRemoveAll');
            data.removeAll();
            if (!silent) {
                me.fireEvent('clear', me, records);
                me.fireEvent('datachanged', me);
            }
            me.callObservers('AfterRemoveAll', [!!silent]);
        }
        if (me.allData) {
            me.allData.removeAll();
        }
        return records;
    }
});
