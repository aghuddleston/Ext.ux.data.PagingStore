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
            proxy: {
              type: 'memory',
              reader: {
                type: 'array'
              }
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
			allData, data;

		if ((typeof start == 'number') && (typeof limit == 'number')) {
			allData = this.data;
			data = new Ext.util.MixedCollection(allData.allowFunctions, allData.getKey);
			data.addAll(allData.items.slice(start, start + limit));
			me.allData = allData;
			me.data = data;
		}
	},

	loadRecords: function (records, options) {
		var me = this,
        length = records.length,
        data   = me.getData(),
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
    var me      = this,
        session = me.getSession(),
        result  = me.getProxy().getReader().read(data, session ? {
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
				Ext.Function.defer(function () {
					if (me.allData) {
						me.data = me.allData;
						delete me.allData;
					}
					me.applyPaging();
					me.fireEvent("datachanged", me);
					me.fireEvent('refresh', me);
					var r = [].concat(me.data.items);
					me.loading = false;
					me.fireEvent("load", me, r, true);
					if (me.hasListeners.read) {
						me.fireEvent('read', me, r, true);
					}

					if (options.callback) {
						options.callback.call(options.scope || me, r, options, true);
					}
				}, 1, me);
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

	doSort: function (sorterFn) {
		var me = this,
			range,
			ln,
			i;

		if (me.remoteSort) {
			// For a buffered Store, we have to clear the prefetch cache since it is keyed by the index within the dataset.
			// Then we must prefetch the new page 1, and when that arrives, reload the visible part of the Store
			// via the guaranteedrange event
			if (me.buffered) {
				me.pageMap.clear();
				me.loadPage(1);
			} else {
				//the load function will pick up the new sorters and request the sorted data from the proxy
				me.load();
			}
		} else {
			if (me.allData) {
				me.data = me.allData;
				delete me.allData;
			}
			me.data.sortBy(sorterFn);
			if (!me.buffered) {
				range = me.getRange();
				ln = range.length;
				for (i = 0; i < ln; i++) {
					range[i].index = i;
				}
			}
			me.applyPaging();
			me.fireEvent('datachanged', me);
			me.fireEvent('refresh', me);
		}
	},

	getTotalCount: function () {
		return this.allData ? this.allData.getCount() : this.totalCount || 0;
	},

	//inherit docs
	getNewRecords: function () {
		if (this.allData) {
			return this.allData.filterBy(this.filterNew).items;
		}
		return this.data.filterBy(this.filterNew).items;
	},

	//inherit docs
	getUpdatedRecords: function () {
		if (this.allData) {
			return this.allData.filterBy(this.filterUpdated).items;
		}
		return this.data.filterBy(this.filterUpdated).items;
	},

	remove: function (records, /* private */ isMove) {
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
    if (Ext.isString(filters)) {
        filters = {
            property: filters,
            value: value
        };
    }
    this.getFilters().add(filters);

//    if (me.allData) {
//      me.data = me.allData;
//      delete me.allData;
//    }
//    me.data = me.data.filter(me.filters.items);
//    me.applyPaging();

	},

	clearFilter: function (suppressEvent) {
		var me = this;

		me.filters.clear();

		if (me.remoteFilter) {

			// In a buffered Store, the meaing of suppressEvent is to simply clear the filters collection
			if (suppressEvent) {
				return;
			}

			// So that prefetchPage does not consider the store to be fully loaded if the local count is equal to the total count
			delete me.totalCount;

			// For a buffered Store, we have to clear the prefetch cache because the dataset will change upon filtering.
			// Then we must prefetch the new page 1, and when that arrives, reload the visible part of the Store
			// via the guaranteedrange event
			if (me.buffered) {
				me.pageMap.clear();
				me.loadPage(1);
			} else {
				// Reset to the first page, clearing a filter will destroy the context of the current dataset
				me.currentPage = 1;
				me.load();
			}
		} else if (me.isFiltered()) {
			me.data = me.snapshot.clone();
			delete me.allData;
			delete me.snapshot;
			me.applyPaging();

			if (suppressEvent !== true) {
				me.fireEvent('datachanged', me);
				me.fireEvent('refresh', me);
			}
		}
	},

	isFiltered: function () {
		var snapshot = this.snapshot;
		return !!snapshot && snapshot !== (this.allData || this.data);
	},

	filterBy: function (fn, scope) {
		var me = this;

		me.snapshot = me.snapshot || me.allData.clone() || me.data.clone();
		me.data = me.queryBy(fn, scope || me);
		me.applyPaging();
		me.fireEvent('datachanged', me);
		me.fireEvent('refresh', me);
	},

	queryBy: function (fn, scope) {
		var me = this,
			data = me.snapshot || me.allData || me.data;
		return data.filterBy(fn, scope || me);
	},

	collect: function (dataIndex, allowNull, bypassFilter) {
		var me = this,
				data = (bypassFilter === true && (me.snapshot || me.allData)) ? (me.snapshot || me.allData) : me.data;

		return data.collect(dataIndex, 'data', allowNull);
	},

	getById: function (id) {
		return (this.snapshot || this.allData || this.data).findBy(function (record) {
			return record.getId() === id;
		});
	},

	removeAll: function (silent) {
		var me = this;

		me.clearData();
		if (me.snapshot) {
			me.snapshot.clear();
		}

		if (me.allData) {
			me.allData.clear();
		}

		// Special handling to synch the PageMap only for removeAll
		// TODO: handle other store/data modifications WRT buffered Stores.
		if (me.pageMap) {
			me.pageMap.clear();
		}
		if (silent !== true) {
			me.fireEvent('clear', me);
		}
	}
});
