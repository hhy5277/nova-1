'use strict';

Nova.CssParse = (function () {

  var api = {
    // given a string of css, return a simple rule tree
    parse: function parse(text) {
      text = this._clean(text);
      return this._parseCss(this._lex(text), text);
    },

    // remove stuff we don't care about that may hinder parsing
    _clean: function _clean(cssText) {
      return cssText.replace(rx.comments, '').replace(rx.port, '');
    },

    // super simple {...} lexer that returns a node tree
    _lex: function _lex(text) {
      var root = { start: 0, end: text.length };
      var n = root;
      for (var i = 0, s = 0, l = text.length; i < l; i++) {
        switch (text[i]) {
          case this.OPEN_BRACE:
            //console.group(i);
            if (!n.rules) {
              n.rules = [];
            }
            var p = n;
            var previous = p.rules[p.rules.length - 1];
            n = { start: i + 1, parent: p, previous: previous };
            p.rules.push(n);
            break;
          case this.CLOSE_BRACE:
            //console.groupEnd(n.start);
            n.end = i + 1;
            n = n.parent || root;
            break;
        }
      }
      return root;
    },

    // add selectors/cssText to node tree
    _parseCss: function _parseCss(node, text) {
      var t = text.substring(node.start, node.end - 1);
      node.parsedCssText = node.cssText = t.trim();
      if (node.parent) {
        var ss = node.previous ? node.previous.end : node.parent.start;
        t = text.substring(ss, node.start - 1);
        // TODO(sorvell): ad hoc; make selector include only after last ;
        // helps with mixin syntax
        t = t.substring(t.lastIndexOf(';') + 1);
        var s = node.parsedSelector = node.selector = t.trim();
        node.atRule = s.indexOf(AT_START) === 0;
        // note, support a subset of rule types...
        if (node.atRule) {
          if (s.indexOf(MEDIA_START) === 0) {
            node.type = this.types.MEDIA_RULE;
          } else if (s.match(rx.keyframesRule)) {
            node.type = this.types.KEYFRAMES_RULE;
          }
        } else {
          if (s.indexOf(VAR_START) === 0) {
            node.type = this.types.MIXIN_RULE;
          } else {
            node.type = this.types.STYLE_RULE;
          }
        }
      }
      var r$ = node.rules;
      if (r$) {
        for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
          this._parseCss(r, text);
        }
      }
      return node;
    },

    // stringify parsed css.
    stringify: function stringify(node, preserveProperties, text) {
      text = text || '';
      // calc rule cssText
      var cssText = '';
      if (node.cssText || node.rules) {
        var r$ = node.rules;
        if (r$ && (preserveProperties || !hasMixinRules(r$))) {
          for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
            cssText = this.stringify(r, preserveProperties, cssText);
          }
        } else {
          cssText = preserveProperties ? node.cssText : removeCustomProps(node.cssText);
          cssText = cssText.trim();
          if (cssText) {
            cssText = '  ' + cssText + '\n';
          }
        }
      }
      // emit rule iff there is cssText
      if (cssText) {
        if (node.selector) {
          text += node.selector + ' ' + this.OPEN_BRACE + '\n';
        }
        text += cssText;
        if (node.selector) {
          text += this.CLOSE_BRACE + '\n\n';
        }
      }
      return text;
    },

    types: {
      STYLE_RULE: 1,
      KEYFRAMES_RULE: 7,
      MEDIA_RULE: 4,
      MIXIN_RULE: 1000
    },

    OPEN_BRACE: '{',
    CLOSE_BRACE: '}'

  };

  function hasMixinRules(rules) {
    return rules[0].selector.indexOf(VAR_START) >= 0;
  }

  function removeCustomProps(cssText) {
    return cssText.replace(rx.customProp, '').replace(rx.mixinProp, '').replace(rx.mixinApply, '').replace(rx.varApply, '');
  }

  var VAR_START = '--';
  var MEDIA_START = '@media';
  var AT_START = '@';

  // helper regexp's
  var rx = {
    comments: /\/\*[^*]*\*+([^/*][^*]*\*+)*\//gim,
    port: /@import[^;]*;/gim,
    customProp: /(?:^|[\s;])--[^;{]*?:[^{};]*?;/gim,
    mixinProp: /(?:^|[\s;])--[^;{]*?:[^{;]*?{[^}]*?};?/gim,
    mixinApply: /@apply[\s]*\([^)]*?\)[\s]*;/gim,
    varApply: /[^;:]*?:[^;]*var[^;]*;/gim,
    keyframesRule: /^@[^\s]*keyframes/
  };

  // exports
  return api;
})();