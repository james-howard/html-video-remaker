// Abstract superclass of all video compositions
// Plays back a list of videos according to some composition into canvas.
class Composition {
    constructor(canvas, videos) {
        this.canvas = canvas;
        this.videos = videos;   
    };
    
    play() { }
    
    stop() { }

    draw() {
        let ctx = this.canvas.getContext('2d');
        let w = this.canvas.width;
        let h = this.canvas.height;
        ctx.save();
        ctx.rect(0, 0, w, h);
        ctx.fillStyle = 'black';
        ctx.fill();
        
        this.drawInContext(ctx);
        
        ctx.restore();
    }
    
    // Subclassers can override to draw their current frame
    drawInContext(ctx) {
    
    }
};

// Utility to letter/pillarbox images
class Rect {
    constructor(x, y, w, h) {
        if (y === undefined) {
            this.origin = new Point(x.origin);
            this.size = new Size(x.size);
        } else {
            this.origin = new Point(x, y);
            this.size = new Size(w, h);
        }
    }
    
    static get Zero() { return new Rect(0, 0, 0, 0); }
    
    get minX() { return this.origin.x; } 
    get midX() { return this.origin.x + this.size.width / 2.0; }
    get maxX() { return this.origin.x + this.size.width; }
    get minY() { return this.origin.y };
    get midY() { return this.origin.y + this.size.height / 2.0 };
    get maxY() { return this.origin.y + this.size.height; };
    
    containsPoint(p) {
        return p.x >= this.minX && p.x <= this.maxX && p.y >= this.minY && p.y <= this.maxY;
    }
    
    equals(r) {
        return r.origin.equals(this.origin) && r.size.equals(this.size);
    }
    
    centeredIn(outer) {
        return new Rect(outer.minX + (outer.size.width - this.size.width) / 2.0,
                                        outer.minY + (outer.size.height - this.size.height) / 2.0,
                                        this.size.width, this.size.height);
    }
    
    alignedToGrid() {
        return new Rect(Math.round(this.origin.x), Math.round(this.origin.y), Math.round(this.size.width), Math.round(this.size.height));
    }
    
    inset(dx, dy) {
        return new Rect(this.origin.x + dx, this.origin.y + dx, this.size.width - 2*dx, this.size.height - 2*dy);
    }
}

class Point {
    constructor(x, y) {
        if (y === undefined) {
            this.x = x.x;
            this.y = x.y;
        } else {
            this.x = x;
            this.y = y;
        }
    }
    
    equals(p) { return p.x == this.x && p.y == this.y }
    
    static get Zero() { return new Point(0, 0); }
}

class Size {
    constructor(width, height) {
        if (height === undefined) {
            this.width = width.width;
            this.height = width.height;
        } else {
            this.width = width;
            this.height = height;
        }
    }
    
    equals(s) { return s.width == this.width && s.height == this.height }
    
    static get Zero() { return new Size(0, 0); }
}

CanvasRenderingContext2D.prototype.drawImageAspectFill = function(image, dstRect) {
    var ctx = this;
    
    var iw = image.naturalWidth;
    var ih = image.naturalHeight;
    if (iw == 0 || ih == 0 || dstRect.size.width == 0 || dstRect.size.height == 0) return;

    var srcAspect = iw / ih;    
    var dstAspect = dstRect.size.width / dstRect.size.height;
    
    ctx.save();
    ctx.translate(dstRect.origin.x, dstRect.origin.y);
    ctx.beginPath();
    ctx.rect(0, 0, dstRect.size.width, dstRect.size.height);
    ctx.clip();

    if (srcAspect < dstAspect) {
        var scale = dstRect.size.width / iw;
        ctx.translate(0.0, (dstRect.size.height - ih*scale)/2.0);
        ctx.scale(scale, scale);
    } else {
        var scale = dstRect.size.height / ih;
        ctx.translate((dstRect.size.width - iw*scale)/2.0, 0.0);
        ctx.scale(scale, scale);
    }
    
    ctx.drawImage(image, 0, 0);
    
    ctx.restore();
}

// Simply plays back videos in order with no transitions.
class Passthrough extends Composition {
    constructor(canvas, videos) {
        super(canvas, videos);
        this.videos.forEach(v => {
            v.addEventListener('ended', this.handleEnd.bind(this));
        });
    }

    play() {
        this.stop();
        this.playing = true;
        this.vidIdx = -1;
        this.playNext();
    }
    
    stop() {
        this.playing = false;
        this.videos.forEach(v => v.pause());
    }
    
    playNext() {
        if (this.videos.length == 0)
            return;
            
        if (this.vidIdx != -1) {
            this.videos[this.vidIdx].pause();
        }
        
        this.vidIdx++;
        if (this.vidIdx == this.videos.length)
            this.vidIdx = 0;
            
        this.videos[this.vidIdx].play();
    }
    
    // Called when a video finishes playing
    handleEnd() {
        if (this.playing)
            this.playNext();
    }
    
    drawInContext(ctx) {
        if (!this.playing)
            return;
        
        ctx.drawImageAspectFill(this.videos[this.vidIdx], new Rect(0, 0, this.canvas.width, this.canvas.height));
    }
}

class Crossfade extends Composition {
    // TODO: Implement Me
}

// Called when video composition button is clicked by user
function go() {
    // Stop any existing composition that may be running
    if (window.videoComposition) {
        window.videoComposition.stop();
        delete window.videoComposition;
    }
        
    // Create offscreen video sources for all the videos in the shelf
    let srcVids = document.getElementById('shelf').children;
    let offscreenVids = [];
    for (let i = 0; i < srcVids.length; i++) {
        let src = srcVids[i];
        let copy = document.createElement('video');
        copy.src = src.src;
        copy.playsinline = true;
        copy.muted = true;
        offscreenVids.push(copy);
    }
    
    // get the mode we're using
    let mode = document.getElementById('composition_type').value;
    console.log("Compositing using mode", mode);
    
    let composition = null;
    let canvas = document.getElementById('output');
    switch (mode) {
        case 'nop':
            composition = new Passthrough(canvas, offscreenVids);
            break;
        case 'crossfade':
            composition = new Crossfade(canvas, offscreenVids);
            break;
        default:
            console.error('Unknown composition mode', mode);
            return;
    }
    
    window.videoComposition = composition;
    window.videoComposition.play();
}

function drawFrame() {
    if (window.videoComposition) {
        window.videoComposition.draw();
    }
    window.requestAnimationFrame(drawFrame);
}

// One time setup to bind event listeners
function setup() {
    document.getElementById('go').addEventListener('click', go);
    window.requestAnimationFrame(drawFrame);
}

setup();
