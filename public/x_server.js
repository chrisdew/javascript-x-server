define('x_server', ['worker_console', 'util', 'fs', 'endianbuffer', 'x_types', 'x_client', 'keymap'], function (console, util, fs, EndianBuffer, x_types, XServerClient, keymap) {
  var module = { exports: {} };

  var default_atoms = [
      'PRIMARY'
    , 'SECONDARY'
    , 'ARC'
    , 'ATOM'
    , 'BITMAP'
    , 'CARDINAL'
    , 'COLORMAP'
    , 'CURSOR'
    , 'CUT_BUFFER0'
    , 'CUT_BUFFER1'
    , 'CUT_BUFFER2'
    , 'CUT_BUFFER3'
    , 'CUT_BUFFER4'
    , 'CUT_BUFFER5'
    , 'CUT_BUFFER6'
    , 'CUT_BUFFER7'
    , 'DRAWABLE'
    , 'FONT'
    , 'INTEGER'
    , 'PIXMAP'
    , 'POINT'
    , 'RECTANGLE'
    , 'RESOURCE_MANAGER'
    , 'RGB_COLOR_MAP'
    , 'RGB_BEST_MAP'
    , 'RGB_BLUE_MAP'
    , 'RGB_DEFAULT_MAP'
    , 'RGB_GRAY_MAP'
    , 'RGB_GREEN_MAP'
    , 'RGB_RED_MAP'
    , 'STRING'
    , 'VISUALID'
    , 'WINDOW'
    , 'WM_COMMAND'
    , 'WM_HINTS'
    , 'WM_CLIENT_MACHINE'
    , 'WM_ICON_NAME'
    , 'WM_ICON_SIZE'
    , 'WM_NAME'
    , 'WM_NORMAL_HINTS'
    , 'WM_SIZE_HINTS'
    , 'WM_ZOOM_HINTS'
    , 'MIN_SPACE'
    , 'NORM_SPACE'
    , 'MAX_SPACE'
    , 'END_SPACE'
    , 'SUPERSCRIPT_X'
    , 'SUPERSCRIPT_Y'
    , 'SUBSCRIPT_X'
    , 'SUBSCRIPT_Y'
    , 'UNDERLINE_POSITION'
    , 'UNDERLINE_THICKNESS'
    , 'STRIKEOUT_ASCENT'
    , 'STRIKEOUT_DESCENT'
    , 'ITALIC_ANGLE'
    , 'X_HEIGHT'
    , 'QUAD_WIDTH'
    , 'WEIGHT'
    , 'POINT_SIZE'
    , 'RESOLUTION'
    , 'COPYRIGHT'
    , 'NOTICE'
    , 'FONT_NAME'
    , 'FAMILY_NAME'
    , 'FULL_NAME'
    , 'CAP_HEIGHT'
    , 'WM_CLASS'
    , 'WM_TRANSIENT_FOR'
  ]

  function XServer (id, sendBuffer, screen) {
    Object.defineProperty(this, 'server', {
        enumerable: false
      , value: this
    });
    this.id = id;
    this.access_control = true;
    this.allowed_hosts = [
        new x_types.InternetHost('127.0.0.1')
    ];
    this.updateAllowedHostsLookup();

    this.sendBuffer = sendBuffer;
    this.screen = screen;
    this.protocol_major = 11;
    this.protocol_minor = 0;
    this.release = 11300000;
    this.vendor = 'JavaScript X';
    this.maximum_request_length = 0xffff;
    this.event_cache = [];
    this.grab = null;
    this.grab_buffer = [];
    this.grab_pointer = null;
    this.grab_keyboard = null;
    this.motion_buffer = [];
    this.motion_buffer_size = 255;
    this.buttons = 0;
    this.input_focus = null;
    this.input_focus_revert = 0;
    this.keymap = keymap.maps.gb.clone();
    this.resource_id_mask = 0x001fffff;
    this.resource_id_bases = [];
    var res_base = this.resource_id_mask + 1;
    var res_id = 0;
    while (!(res_id & 0xE0000000)) {
      this.resource_id_bases.push(res_id += res_base);
    }
    
    this.formats = [
        new x_types.Format(0x01, 0x01, 0x20)
      , new x_types.Format(0x04, 0x08, 0x20)
      , new x_types.Format(0x08, 0x08, 0x20)
      , new x_types.Format(0x0f, 0x10, 0x20)
      , new x_types.Format(0x10, 0x10, 0x20)
      , new x_types.Format(0x18, 0x20, 0x20)
      , new x_types.Format(0x20, 0x20, 0x20)
    ];
    this.screens = [
        new x_types.Screen(
            0x00000026 // root
          , 0x00000022 // def colormap
          , 0x00ffffff // white
          , 0x00000000 // black
          , 0x00000000 // current input masks
          , $('.screen').width() // width px
          , $('.screen').height() // height px
          , Math.round($('.screen').width() / (96 / 25.4)) // width mm
          , Math.round($('.screen').height() / (96 / 25.4)) // height mm
          , 0x0001 // min maps
          , 0x0001 // max maps
          , 0x20 // root visual
          , 2 // backing stores 0 Never, 1 WhenMapped, 2 Always
          , 1 // save unders
          , 0x18 //24 default depth
          , [ // depths
                new x_types.Depth(
                    0x01 // depth 1
                )
              , new x_types.Depth(
                    0x18 // depth 24
                  , [ // visualtypes
                        new x_types.VisualType(
                            0x00000020 // id
                          , 0x04 // class
                          , 0x08 // bits per rgb
                          , 0x0100 // colormap entries
                          , 0x00ff0000 // red mask
                          , 0x0000ff00 // green mask
                          , 0x000000ff // blue mask
                        )
                      , new x_types.VisualType(
                            0x00000021 // id
                          , 0x05 // class
                          , 0x08 // bits per rgb
                          , 0x0100 // colormap entries
                          , 0x00ff0000 // red mask
                          , 0x0000ff00 // green mask
                          , 0x000000ff // blue mask
                        )
                    ]
                )
            ]
        )
    ];
    this.atoms = default_atoms.slice();
    this.atom_owners = [];
    this.resources = {}
    this.resources[0x00000022] = new x_types.ColorMap(
        0x00000022
      , function (rgb, type) {
          rgb = [
              (rgb & 0x000000ff)
            , (rgb & 0x0000ff00) >> 8
            , (rgb & 0x00ff0000) >> 16
          ];
          switch (type) {
            case 'hex':
              return rgb.reduce(function (str, v) { v = v.toString(16); return str + (v.length < 2 ? '0' : '') + v }, '');
            default:
              return rgb;
          }
        }
    );
    this.resources[0x00000026] = this.root = new x_types.Window(
        this
      , 0x00000026
      , 0x18 // depth 24
      , 0, 0
      , this.screen.width(), this.screen.height()
      , 0, 1, 0
    );
    this.root.parent = { element: $('.screen'), owner: this, children: [this.root] }
    this.font_path = 'fonts';
    this.fonts_dir = {};
    this.fonts_scale = {};
    this.fonts_cache = {};

    fs.readFile(this.font_path + '/fonts.dir', 'utf8', function (err, file) {
      if (err)
        throw new Error('No fonts.dir');
      file = file.split('\n');
      file.pop();
      var count = file.shift() ^ 0;
      if (count !== file.length)
        throw new Error('Invalid length of fonts.dir');
      file.forEach(function (line) {
        var match = line.match(/^(".*"|[^ ]*) (.*)$/);
        this.fonts_dir[match[2]] = match [1];
      }.bind(this));
    }.bind(this));

    this.clients = {};
    var c = this.resources[0x00000026].canvas[0].getContext('2d')
      , img = new Image;
    img.onload = function () {
      c.rect(0, 0, $('.screen').width(), $('.screen').height());
      c.fillStyle = c.createPattern(img, 'repeat');
      c.fill();
    }
    img.src = "/check.png";

    this.resources[0x00000026].map();

    this.mouseX = this.mouseY = 0;
    var self = this;
    this.screen.on('mousemove.xy', function (event) {
      self.mouseX = event.offsetX;
      self.mouseY = event.offsetY;
    });
  }

  XServer.prototype.__defineGetter__('clients_array', function () {
    return Object.keys(this.clients).map(function (id) { return this.clients[id] }, this);
  });

  XServer.prototype.__defineGetter__('resources_array', function () {
    return Object.keys(this.resources).map(function (id) { return this.resources[id] }, this);
  });

  XServer.prototype.getFormatByDepth = function (depth) {
    return this.formats.filter(function (format) {
      return format.depth === depth;
    })[0];
  }

  XServer.prototype.newClient = function (id, host, port, host_type) {
    host = new x_types.Host(host, host_type);
    host.port = port;
    if (! (~ this.allowed_hosts.lookup.indexOf(host.toString())))
      throw new Error('FIXME: Host not allowed');
    return this.clients[id] = new XServerClient(this, id, this.resource_id_bases.shift(), this.resource_id_mask, host);
  }

  XServer.prototype.disconnect = function (id) {
    if (!id) {
      this.screen.off('');
      return Object.keys(this.clients).forEach(function (cid) {
        this.clients[cid].disconnect();
      }.bind(this));
    } // Disconnect whole server
    if (!this.clients[id])
      throw new Error('Invalid client! Disconnected?');

    if (this.grab && this.grab.id !== id) {
      return this.grab_buffer.push([this, 'disconnect', id]);
    }

    this.resource_id_bases.push(this.clients[id].resource_id_base);
    this.clients[id].disconnect();
  }
  
  XServer.prototype.sendEvent = function () {}

  XServer.prototype.write = function (client, data) {
    if (! this.clients[client.id])
      throw new Error('Invalid client! Disconnected?');
    if (! data)
      return console.warn('Empty data');
    if (data instanceof x_types.WorkReply)
      return this.sendBuffer(data, client, true);
    if (! (data instanceof EndianBuffer))
      throw new Error('Not a buffer! ' + data.constructor.name);
    this.sendBuffer(data.buffer, client);
  }

  XServer.prototype.processRequest = function (message) {
    var client = this.clients[message.id];
    if (this.grab && this.grab !== client)
      return this.grab_buffer.push([this, 'processRequest', message]);
    console.log('Request', message.id, message.type);
    client.processRequest(message);
  }

  XServer.prototype.getResource = function (id, Type, allowed_values) {
    var resource = this.resources[id];
    allowed_values = Array.isArray(allowed_values) ? 
      allowed_values : Array.prototype.slice.call(arguments, 2);
    if (~ allowed_values.indexOf(id))
      return id;
    if (Type && !(resource instanceof Type))
      throw new x_types.Error({}, Type.error_code || 1, id);
    return resource;
  }
  
  XServer.prototype.putResource = function (resource) {
    var owner = resource.owner;
    console.warn('server.putResource', resource.id, resource);
    if (((~ owner.resource_id_mask) & owner.resource_id_base) !== owner.resource_id_base)
      throw new x_types.Error({}, 14 /* IDChoise */, resource.id); 
    if (this.resources[resource.id])
      throw new x_types.Error({}, 14 /* IDChoice */, resource.id);
    return this.resources[resource.id] = resource;
  }
  
  XServer.prototype.freeResource = function (id, Type) {
    var resource = this.resources[id];
    console.warn('server.freeResource', id, resource);
    if (Type && !(resource instanceof Type))
      throw new x_types.Error({}, Type.error_code || 1, id);
    delete this.resources[id];
  }
  
  XServer.prototype.resolveAtom = function (id) {
    switch (typeof id) {
      case 'number':
      break;
      case 'string':
      break;
      case 'object':
        if (id instanceof x_types.Atom)
          return this.atoms[x_types.atom.id]
        else 
      break;
      default:
        throw new Error('trying to resolve something that is not a number, string or Atom');
    }
  }
  
  XServer.prototype.getAtom = function (id, dont_throw) {
    if ('string' === typeof id) {
      if (~ this.atoms.indexOf(id))
        return this.atoms.indexOf(id) + 1;
      if (dont_throw)
        return 0;
      throw new x_types.Error({}, 5);
    } else {
      if ('string' === typeof this.atoms[id - 1])
        return this.atoms[id];
      if (dont_throw)
        return '';
      throw new x_types.Error({}, 5);
    }
  }

  XServer.prototype.putAtom = function (id, atom, only_if_exists) {
    if (this.atoms[id])
      throw new x_types.Error({}, 14 /* IDChoice */, atom.id);
    return this.atoms[atom.id] = atom;
  }
  
  XServer.prototype.freeAtom = function (id) {
    var atom = this.atoms[id];
    if (!(resource instanceof x_types.Atom))
      throw new x_types.Error({}, 14 /* IDChoice */);
    delete this.atoms[id];
  }

  XServer.prototype.flushGrabBuffer = function() {
    this.grab_buffer.splice(0)
      .forEach(function (item) {
        var self = item[0]
          , func = item[1]
          , args = item.slice(2);
        self[func].apply(self, args);
      });
  }

  XServer.prototype.listFonts = function (pattern) {
    var re = new RegExp('^' + pattern.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1").replace(/\\([*?])/g, '.$1') + '$', 'i');
    return Object.keys(this.fonts_dir).filter(function(name) { return re.test(name) });
  }

  XServer.prototype.resolveFont = function (name) {
    var resolved_name;
    if (! (name in this.fonts_dir)) {
      if (/[*?]/.test(name)) {
        var names = this.listFonts(name);
        if (names && names.length)
          resolved_name = [names[0], this.fonts_dir[names[0]]];
      }
    }
    return resolved_name || [name, this.fonts_dir[name]];
  }

  XServer.prototype.loadFont = function (resolved_name, server_name, callback) {
    var self = this;
    console.log('XServer.loadFont', [].slice.call(arguments));
    console.log('Font cached?', resolved_name in this.fonts_cache);
    if (resolved_name in this.fonts_cache)
      return callback(null, this.fonts_cache[resolved_name]);
    self.grab = 'loadFont';
    fs.readFile('fonts/' + resolved_name + '.meta.json', 'utf8', function (err, meta) {
      console.log('read meta');
      if (err)
        return callback(err);
      try {
        meta = JSON.parse(meta);
      } catch (e) {
        return callback(e);
      }
      var font = new x_types.Font(meta.type, resolved_name, server_name);
      font.meta = meta;
      font.loadData(function (err) {
        self.grab = null;
        console.log('XServer.loadFont callback', [].slice.call(arguments));
        if (!err) {
          console.log('Font loaded', font);
        }
        self.fonts_cache[resolved_name] = font;
        console.log('Font loaded2', font);
        callback(err, font);
      });
    });
  }

  XServer.prototype.openFont = function (client, fid, name) {
    var self = this
      , resolved_name = this.resolveFont(name);
    if (resolved_name[1]) {
      this.grab = 'openFont';
      this.loadFont(resolved_name[1], resolved_name[0], function (err, font) {
        font.id = fid;
        font.owner = client;
        if (err)
          font.error = err;
        else
          self.putResource(font);
        console.log('XServer.openFont callback', err, font);
        self.grab = false;
        self.flushGrabBuffer();
      });
      return;
    }
    console.log('Name not resolved', name);
    this.grab = false;
    this.flushGrabBuffer();

  }

  XServer.prototype.encodeString = function (str) {
    var out_str = '';
    if (typeof str !== 'string')
      return str;
    for (var i = 0; i < str.length; i ++) {
      var v = str.charCodeAt(i);
      if (v < 0x21) {
        out_str += String.fromCharCode(0x2400 + v);
        continue;
      }
      if (v > 0x7e && v < 0xa1) {
        out_str += String.fromCharCode(0xf800 - 0x7e + v);
        continue;
      }
      out_str += str.charAt(i);
    }
    return out_str;
  }

  XServer.prototype.updateAllowedHostsLookup = function () {
    this.allowed_hosts.lookup = this.allowed_hosts.map(function (host) {
      return host.toString();
    });
  }

  XServer.prototype.insertAllowedHost = function (host) {
    if (!(host instanceof x_types.Host))
      throw new Error('Requires x_types.Host subprototype')
    if (~ this.allowed_hosts.lookup.indexOf(host.toString()))
      return null;
    var index = this.allowed_hosts.push(host);
    this.updateAllowedHostsLookup();
    return index;
  }

  XServer.prototype.deleteAllowedHost = function (host) {
    if (!(host instanceof x_types.Host))
      throw new Error('Requires x_types.Host subprototype')
    var index = this.allowed_hosts.lookup.indexOf(host.toString());
    if (!~ index)
      return null;
    this.allowed_hosts.splice(index, 1);
    this.updateAllowedHostsLookup();
    return index;
  }

  return XServer;
});
