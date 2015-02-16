var Harness = Siesta.Harness.Browser.ExtJS;

Harness.configure({
    title       : 'Ext.ux.data.PagingStore Test Suite',
    preload     : [
		{ text : 'console.log("begin main preloading");' },
		"http://extjs.cachefly.net/ext-4.1.0-gpl/ext-all.js",
		'./Ext.ux.data.PagingStore.js',
		{ text : 'console.log("finishing preloading");' }
	]
});

Harness.start(
  '01_ArrayPagingStoreTest.js',
  '02_JsonPagingStoreTest.js'
);
