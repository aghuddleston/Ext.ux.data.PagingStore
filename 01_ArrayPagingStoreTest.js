StartTest({ 
  alsoPreload: [
    '../../../../extjs-4.1.1/ux/data/PagingStore.js'
  ]
}, function(t) {

    Ext.define('Artist', {
        extend: 'Ext.data.Model',
        fields: [
            {name: 'name', type: 'string'},
            {name: 'genre',  type: 'string'}
        ]
    });

    var myData = [
		['Miles Davis', 'Jazz'],
		['Beck', 'Rock'],
		['Lucious Jackson', 'Rock'],
		['Jack Johnson', 'Rock'],
		['Horace Silver', 'Jazz'],
		['Atlas Genius', 'Rock'],
		['Jamiroqui', 'Rock'],
		['Skye', 'Rock'],
		['Morcheeba', 'Rock'],
		['Josh Ritter', 'Folk']
    ];

    var myStore = Ext.create('Ext.ux.data.PagingStore', {
        model: 'Artist',
        pageSize: 3,
        proxy: {
            type: 'memory',
            reader: {
                type: 'array'
            }
        },
	    data: myData
    });

	var rec, recs;

	t.chain(
		{
			action: function(next) {
				t.ok(myStore.data, 'data populated');
				t.ok(myStore.allData, 'allData populated');

				t.is(myStore.data.length, 3, 'Store is paged');
				t.is(myStore.allData.length, 10, 'All data is there');
				t.is(myStore.getTotalCount(), 10, 'Total count looks at allData');

				rec = myStore.last();
				t.is(rec.get('name'), 'Lucious Jackson', '3rd record');

				myStore.nextPage();
				next();
			}
		},
		{
			action: function(next) {
				setTimeout(next, 50);
			}
		},
		{
			action: function(next) {
				t.is(myStore.data.length, 3, 'Store is paged');
				t.is(myStore.allData.length, 10, 'All data is there');

				rec = myStore.last();
				t.is(rec.get('name'), 'Atlas Genius', '3rd record');

				myStore.add([
					['Lumineers', 'Rock'],
					['Stan Getz', 'Jazz']
				]);

				t.is(myStore.data.length, 5, 'Records added to current page');
				t.is(myStore.getCount(), 5, 'Records via count');
				t.is(myStore.allData.length, 12, 'All data is there');
				t.is(myStore.getTotalCount(), 12, 'Records via getTotalCount');

				recs = myStore.getModifiedRecords();
				t.is(recs.length, 2, '2 modified records');

				myStore.sort('name', 'ASC');
				t.is(myStore.currentPage, 2, 'Current page is still 2');
				t.is(myStore.data.length, 3, '3 records on current page');
				t.is(myStore.allData.length, 12, 'All data is there');
				rec = myStore.first();
				t.is(rec.get('name'), 'Jack Johnson', 'sorted first record on page 2');

				myStore.filter('genre', 'Rock');
				t.is(myStore.data.length, 3, '3 records on current page');
				t.is(myStore.allData.length, 8, '8 recs left in filter');

				myStore.clearFilter();
				t.is(myStore.data.length, 3, '3 records on current page');
				t.is(myStore.allData.length, 12, 'All data is there');

				myStore.loadPage(1);
				t.is(myStore.currentPage, 1, 'Go back to page 1');
				t.is(myStore.data.length, 3, '3 records on current page');
				t.is(myStore.allData.length, 12, 'All data is there');

				myStore.filterBy(function(rec,id){
					var genre = rec.get('genre');
					return (genre === 'Rock');
				});
				t.is(myStore.currentPage, 1, 'Current page is 1');
				t.is(myStore.data.length, 3, '3 records on current page');
				t.is(myStore.allData.length, 8, '8 recs left in filter');
				t.is(myStore.getTotalCount(), 8, 'Records via getTotalCount');
				rec = myStore.first();
				t.is(rec.get('name'), 'Atlas Genius', 'filtered first record on page 1');

				myStore.nextPage();
				next();
			}
		},
		{
			action: function(next) {
				setTimeout(next, 50);
			}
		},
		{
			action: function(next) {
				t.is(myStore.currentPage, 2, 'Back to page 2');
				t.is(myStore.data.length, 3, '3 records on current page');
				t.is(myStore.allData.length, 8, 'All data is there');
				rec = myStore.first();
				t.is(rec.get('name'), 'Jamiroqui', 'filtered first record on page 2');

				myStore.clearFilter();
				t.is(myStore.data.length, 3, '3 records on current page');
				t.is(myStore.allData.length, 12, 'All data is there');

				rec = myStore.findRecord('name', 'Jack Johnson');
				myStore.remove(rec);
				t.is(myStore.data.length, 2, 'Records added to current page');
				t.is(myStore.getCount(), 2, 'Records via count');
				t.is(myStore.allData.length, 11, 'All data is there');
				t.is(myStore.getTotalCount(), 11, 'Records via getTotalCount');

				myStore.removeAll();
				t.is(myStore.data.length, 0, 'Current page records removed');
				t.is(myStore.getCount(), 0, 'Records via count');
				t.is(myStore.allData.length, 0, 'All records removed');
				t.is(myStore.getTotalCount(), 0, 'Records via getTotalCount');

				console.log('about to call next ArrayPagingStore');
				next();
			}
		},
		{
			action: function(next) {
				console.log("about to loadRecords");
				console.log(myData);
				console.log(myStore);
				myStore.loadRecords(myData);
				console.log("after loadRecords");
				t.is(myStore.data.length, 3, 'Store is paged');
				t.is(myStore.allData.length, 10, 'All data is there');
				t.is(myStore.getTotalCount(), 10, 'Total count looks at allData');

				rec = myStore.last();
				t.is(rec.get('name'), 'Lucious Jackson', '3rd record');

				myStore.removeAll();
				t.is(myStore.data.length, 0, 'Current page records removed');
				t.is(myStore.getCount(), 0, 'Records via count');
				t.is(myStore.allData.length, 0, 'All records removed');
				t.is(myStore.getTotalCount(), 0, 'Records via getTotalCount');
				next();
			}
		}
	);



//	setTimeout(function() {
//	}, 100);

});
