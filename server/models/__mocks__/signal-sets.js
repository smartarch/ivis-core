function query(context, query) {
    const results = [
        {id: "9", siga: 123, sigb: "ahoj", sigc: true},
        {id: "8", siga: 42.6, sigb: "jak", sigc: false},
        {id: "7", siga: 96, sigb: "se", sigc: true},
        {id: "6", siga: 693, sigb: "mas", sigc: true},
        {id: "5", siga: 69, sigb: "me", sigc: false},
        {id: "4", siga: 159, sigb: "z", sigc: true},
        {id: "3", siga: 3.14, sigb: "toho", sigc: false},
        {id: "2", siga: 2.7, sigb: "asi", sigc: false},
        {id: "1", siga: 666, sigb: "brzy", sigc: true},
        {id: "0", siga: 22, sigb: "klepne", sigc: false}
    ];
    return [{docs: results, total: 10}];
}

module.exports.query = query;
