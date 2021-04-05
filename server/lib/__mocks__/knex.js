const knex = (table) => {
    if (table === 'signal_sets') return { where: (a, b) => {return {first: (c) => {return {cid: "thecid"}}}}};
    if (table === 'signals') return { where: (a, b) => {return {select: (c) => {return [{cid: "siga"}, {cid: "sigb"}, {cid: "sigc"}]}}}};
};

module.exports = knex;
