/**
 * @author Bc. Michal Kacerovský
 * @version 1.0
 */

define([
    'jquery',
    'cz/kajda/data/AbstractDataSource',
    'cz/kajda/data/Collection',
    'momentjs'
],
function($, AbstractDataSource, Collection, moment) {
    

/**
 * Data source used for test purpose.
 * It generates random entities and relations.
 */
var RandSource = new Class("RandSource", {
   
    _extends : AbstractDataSource,

    /**
     * @constructor
     * @param {Object} config 
     * @param {Class} T_entity object that entities should be mapped to
     * @param {Class} T_relation object that relations should be mapped to
     */
    _constructor: function(config, T_entity, T_relation) {
        AbstractDataSource.call(this, T_entity, T_relation);
        this._config = $.extend(this._DEFAULTS, config);
        this._durationDist = new this.GaussianDist(this._config.durationDist.mean, this._config.durationDist.dev);
        this._relationDist = new this.GaussianDist(this._config.relationDist.mean, this._config.relationDist.dev);
        this._priorityDist = new this.GaussianDist(this._config.priorityDist.mean, this._config.priorityDist.dev);
    },

    _DEFAULTS : {
       // number of entities
       count : 100,
       
       // entity duration distribution
       durationDist : {
           mean : 100,
           dev : 30,
           // units
           unit : 'year'
       },
       
       // relation count distribution for an entity
       relationDist : {
           mean : 20,
           dev: 5
       },
       
       // entity priority distribution
       priorityDist : {
           mean : 100,
           dev: 0
       },
       
       // probability that the entity is momental, not interval
       momentProbability : 0.4,
       
       types : ["person"],
       relTypes : ["part_of", "creation", "participation", "cause", "takes_place", "interaction", "relationship"],
    },
    
	/** @member {RandSource~GaussianDist} entity duration distribution */
    _durationDist : null,
	
	/** @member {RandSource~GaussianDist} an entity relation count distribution */
    _relationDist : null,
	
	/** @member {RandSource~GaussianDist} entity priority distribution */
    _priorityDist : null,
   
    //<editor-fold defaultstate="collapsed" desc="private methods">
    

        /**
         * Generates relation between two randomly selected entities.
         */
        _generateRelation : function(id) {
            var from = Math.round(Math.random() * (this._config.count - 1));
            var to = -1;
            do {
                to = Math.round(Math.random() * (this._config.count - 1));
            } while(to === from);

            var opts = {
                id : id,
                name : this._getRandName(32),
                stereotype : this._config.relTypes[Math.round(Math.random() * (this._config.relTypes.length - 1))],
                from : from,
                to : to
            }
            var relation = new this._objectMapping.relation(opts);


            this._entities.get(from).addRelation(relation);
            this._entities.get(to).addRelation(relation);
            return relation;
        },

        /**
         * Generates random entity according to the given distributions.
         */
        _generateEntity : function(id) {
            var uniFormat = "YYYYYY-MM-DDTHH:mm:ss";
            var begin = this._getRandDate(uniFormat);
            var opts = {
                id : id,
                name : this._getRandName(32),
                begin : begin.format(uniFormat),
                importance : this._priorityDist.next(),
                stereotype : this._config.types[Math.round(Math.random() * (this._config.types.length - 1))],
                inEdges : [],
                outEdges : [],
                properties : {}
            };

			// if rand matches the probability of being a momental entity
            if(Math.random() > this._config.momentProbability)           
                 opts.end = begin.clone().add(this._getRandDuration()).format(uniFormat);

            var e = new this._objectMapping.entity(opts);

            return e;
        },

		/**
		 * Generates random number of random relations for an entity 
		 */
        _getRandEdges : function(id) {
            var len = this._relationDist.next();
            var edges = [];
            for(var i = 0; i < len; i++) {
                var rand = -1;
                do {
                    rand = Math.round(Math.random() * this._config.count);
                } while(edges.indexOf(rand) >= 0 || rand === id);
                edges.push(rand);
            }
            return edges;
        },

		/**
		 * Generates random string.
		 */
        _getRandName : function(len) {
            var chars = "abcdefghijklmnopqrstuv  ";
            var res = "";
            for(var i = 0; i < len; i++) {
                res += chars.charAt(Math.round(Math.random() * (chars.length-1)));
            }
            return res.substr(0,1).toUpperCase() + res.substr(1);
        },

        /**
         * Generates random time in the time raneg interval.
         */
        _getRandDate : function() {
            var su = this._timeRange.start.unix(),
                    eu = this._timeRange.end.unix();
            var unx = su + (Math.round(Math.random() * (eu - su)));
            return moment.unix(unx).utc();
        },

		/**
		 * Generates random duration according to its distribution.
		 */
        _getRandDuration : function() {
            return moment.duration(this._durationDist.next(), this._config.durationDist.unit);
        },
        
    //</editor-fold>

    //<editor-fold defaultstate="collapsed" desc="overridden">

        /** @see cz.kajda.data.AbstractDataSource#loadData */
        loadData : function() {
            this._entities = new Collection();
            this._relations = new Collection();
            for(var i = 0; i < this._config.count; i++) {
                this._entities.add(this._generateEntity(i));
            }
            for(var i = 0; i < this._config.count*3; i++) {
                this._relations.add(this._generateRelation(i));
            }
            this._fireEvent("dataLoaded", this);
        },
    
    //</editor-fold>
    
    //<editor-fold defaultstate="collapsed" desc="RandSource.Dist">
    
        GaussianDist : new Class("RandSource~GaussianDist", {
            
            _constructor : function(mean, stddev) {
                this._mean = mean;
                this._stddev = stddev;
            },
            
            _mean : null,
            _stddev : null,
            
            next : function() {
                // according to the central limit theorem
                var sum = 0;
                for(var i = 0; i < 12; i++)
                    sum += Math.random();
                return this._mean + (sum-6) * this._stddev;
            }
            
        })
    
    //</editor-fold>

    
});
    
return RandSource;
});

