
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    projectOid:23112780161,
    tagOid:21580021389,
    intervals:[],
    numberOfMonths:6,
    grids:[],
    queue:[[]],
    queueTypes: ['Created - not Opened','Opened - not Assigned', 'Assigned - not In-Progress', 'In-Progress - not Accepted'],
    counters:[],
    launch: function() {
        this.setIntervals();
        this.makeArrayOfQueues();
        for(var i=0; i<this.queueTypes.length; i++){
            this.getData(this.queueTypes[i], i);
        }
        
        
    },
    
    makeArrayOfQueues:function(){
        var numOfQueueTypes = this.queueTypes.length;
        this.queue = new Array(numOfQueueTypes);
        for (var i = 0; i < numOfQueueTypes; i++) {
            this.queue[i] = [];
        }
    },
    
    setIntervals:function(){
        this._myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Please wait.This may take long depending on your data..."});
        this._myMask.show();
        var now = new Date();
        var firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        console.log('firstDayOfThisMonth',firstDayOfThisMonth); 
        Date.prototype.calcFullMonths = function(monthOffset) {
            var d = new Date(firstDayOfThisMonth); 
            d.setMonth(d.getMonth() - monthOffset);
            return d;
        };
        
        var howFarBack = (new Date()).calcFullMonths(this.numberOfMonths);
        for(var m=1; m <= this.numberOfMonths; m++){
            var firstDayOfNextMonth = new Date(howFarBack.getFullYear(), howFarBack.getMonth() + 1, 1);
            this.intervals.push({
                'from'  :   Rally.util.DateTime.format(howFarBack, 'Y-m-d'),          
                'to'    :   Rally.util.DateTime.format(firstDayOfNextMonth, 'Y-m-d'), 
                'month' :   howFarBack.toLocaleString('en-us', { month: 'long' }),
                'index' :   m
            });
            
            howFarBack = firstDayOfNextMonth;
        }
        console.log(this.intervals);
        for(var i=0; i<this.queueTypes.length; i++){
            this.counters.push(this.intervals.length);
        }
    },
    
    getData:function(queueType, index){
        _.each(this.intervals, function(interval){
            console.log('interval.to', interval.to);
            this.getSnapshots(interval, queueType, index);
        },this);    
    },
    
    getSnapshots:function(interval, queueType, index){
        console.log('this.counters[index]:',this.counters[index], 'interval', interval, 'queueType', queueType);
        var find = this.getFindClause(interval, queueType);
        console.log('get Snapshots up to ', interval.to);
        Ext.create('Rally.data.lookback.SnapshotStore', {
            fetch: ['ObjectID','_ValidFrom','_ValidTo',
                    'Tags','ScheduleState','State'],
            find:find
            }).load({
                callback: function(records, operation, success) {
                    console.log('records.length for',interval.month, records.length);
                    if (records.length > 0) {
                        var snapshotsNoDupes = _.uniq(records, function(record){
                            return record.data.ObjectID;
                        });
                        console.log('snapshotsNoDupes length',snapshotsNoDupes.length);
                        this.queue[index].push({'interval': interval.month, 'count':snapshotsNoDupes.length, 'index':interval.index, 'queue':queueType});
                        this.counters[index]--;
                        if (this.counters[index] === 0) {
                            this.makeGrid(index);
                        }
                    }
                },
                scope:this,
                params : {
                    compress : true,
                    removeUnauthorizedSnapshots : true
                }
            });
    },
    
    getFindClause:function(interval, queueType){
        if (queueType === 'Created - not Opened') {
            find = {
                '_TypeHierarchy':'Defect',
                '_ProjectHierarchy':this.projectOid,
                'State':'Submitted',
                'Tags': this.tagOid,
                //'_ValidFrom':{'$lte':interval.to},'_ValidTo':{'$gt':interval.to}
                '_ValidFrom':{'$lte':interval.from},'_ValidTo':{'$gt':interval.from}
                
            };
        }
        else if (queueType === 'Opened - not Assigned') {
            find = {
                '_TypeHierarchy':'Defect',
                'State':'Open',
                'Project': this.projectOid,
                'Tags': this.tagOid,
                //'_ValidFrom':{'$lte':interval.to},'_ValidTo':{'$gt':interval.to}
                '_ValidFrom':{'$lte':interval.from},'_ValidTo':{'$gt':interval.from}
            };
        }
        else if (queueType === 'Assigned - not In-Progress') {
            find = {
                '_TypeHierarchy':'Defect',
                'ScheduleState':{'$lt':'In-Progress'},
                'Project': {'$ne':this.projectOid},
                'Tags': this.tagOid,
                //'_ValidFrom':{'$lte':interval.to},'_ValidTo':{'$gt':interval.to}
                '_ValidFrom':{'$lte':interval.from},'_ValidTo':{'$gt':interval.from}
            };
        }
        else if (queueType === 'In-Progress - not Accepted') {
            find = {
                '_TypeHierarchy':'Defect',
                'ScheduleState':'In-Progress',
                //'Project': {'$ne':this.projectOid},
                'Tags': this.tagOid,
                //'_ValidFrom':{'$lte':interval.to},'_ValidTo':{'$gt':interval.to}
                '_ValidFrom':{'$lte':interval.from},'_ValidTo':{'$gt':interval.from}
            };
        }
        return find;
        
    },
    
    makeGrid:function(i){
        this._myMask.hide();
        _.each(this.queue[i], function(q){
            console.log('q',q);
        });
        this.queue[i] = _.sortBy(this.queue[i], function(q) {
            return [q.index];
        });
        console.log(this.queue[i]);
        this.grids.push({
            viewConfig: {
                enableTextSelection: true
            },
            xtype: 'rallygrid',
            itemId: 'queueGrid'+i,
            title: this.queue[i][0].queue,
            showPagingToolbar: false,
            store: Ext.create('Rally.data.custom.Store', {
                data: this.queue[i]
            }),
            columnCfgs: [
                {text: 'Interval',  dataIndex: 'interval'},
                {text: 'Count',  dataIndex: 'count'}
            ],
            margin: 10
        });
        
       if (this.grids.length === this.queueTypes.length) {
            this.grids = _.sortBy(this.grids, function(grid) {
                return [grid.itemId];
            });
            this.showGrids();
       }
    },
    showGrids:function(){
        _.each(this.grids, function(grid){
            this.add(grid);
        },this);
    }
});

