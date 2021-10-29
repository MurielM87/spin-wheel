import * as util from './wheel.util.js';
import * as enums from './wheel.enums.js';
import * as drag from './wheel.drag.js';

export default class Wheel {

  constructor(container, props = {}) {
    this.canvasContainer = container;
    this.initCanvas();

    // Initalise some required properties:
    this.itemBackgroundColors = [];
    this.itemLabelColors = [];
    this.offset = {w: 0, h: 0};

    if (props) this.init(props);
  }

  initCanvas() {

    // Remove any existing children:
    while (this.canvasContainer.firstChild) {
       this.canvasContainer.removeChild(this.canvasContainer.firstChild);
    }

    this.canvas = document.createElement('canvas');
    this.canvasContainer.appendChild(this.canvas);
    this.context = this.canvas.getContext('2d');

    this.registerEvents();

  }

  /**
   * Initialise the instance with the given properties.
   * If any properties are omitted, then default values will be applied.
   * See README.md for property descriptions.
   */
  init(props = {}) {

    this.debug = props.debug;
    this.image = props.image;
    this.isInteractive = props.isInteractive;
    this.itemBackgroundColors = props.itemBackgroundColors;
    this.itemLabelAlign = props.itemLabelAlign;
    this.itemLabelBaselineOffset = props.itemLabelBaselineOffset;
    this.itemLabelColors = props.itemLabelColors;
    this.itemLabelFont = props.itemLabelFont;
    this.itemLabelFontSizeMax = props.itemLabelFontSizeMax;
    this.itemLabelRadius = props.setItemLabelRadius;
    this.itemLabelRadiusMax = props.setItemLabelRadiusMax;
    this.itemLabelRotation = props.setItemLabelRotation;
    this.items = props.items;
    this.lineColor = props.lineColor;
    this.lineWidth = props.lineWidth;
    this.maxRotationSpeed = props.maxRotationSpeed;
    this.radius = props.radius;
    this.rotation = props.rotation;
    this.rotationResistance =props.rotationResistance;
    this.rotationSpeed = props.rotationSpeed;
    this.offset = props.offset;
    this.onRest = props.onRest;
    this.onSpin = props.onSpin;
    this.overlayImage = props.overlayImage;
    this.pointerRotation = props.items;

    this.resize(); // This will start the animation loop.

  }

  registerEvents() {
    window.onresize = () => this.resize();
    drag.registerEvents(this);
  }

  /**
   * Resize the wheel to fit (contain) inside it's container.
   * Call this after changing any property of the wheel that relates to it's size or position.
   */
  resize() {

    // Reset the animation loop:
    window.cancelAnimationFrame(this.frameRequestId); // Cancel previous animation loop.

    // Get the smallest dimension of `canvasContainer`:
    const [w, h] = [this.canvasContainer.clientWidth, this.canvasContainer.clientHeight];

    // Calc the size that the wheel needs to be to fit in it's container:
    const minSize = Math.min(w, h);
    const wheelSize = {
      w: minSize - (minSize * this.offset.w),
      h: minSize - (minSize * this.offset.h),
    };
    const scale = Math.min(w / wheelSize.w, h / wheelSize.h);
    this.size = Math.max(wheelSize.w * scale, wheelSize.h * scale);

    // Resize canvas element:
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = w;
    this.canvas.height = h;

    // Re-calculate the center of the wheel:
    this.center = {
      x: w / 2 + (w * this.offset.w),
      y: h / 2 + (h * this.offset.h),
    };

    // Recalculate the wheel radius:
    this.actualRadius = (this.size / 2) * this.radius;

    // Adjust the font size of labels so they all fit inside `wheelRadius`:
    this.itemLabelFontSize = this.itemLabelFontSizeMax * (this.size / enums.fontScale);
    this.labelMaxWidth = this.actualRadius * (this.itemLabelRadius - this.itemLabelRadiusMax);
    this.actualItems.forEach((i) => {
      this.itemLabelFontSize = Math.min(this.itemLabelFontSize, util.getFontSizeToFit(i.label, this.itemLabelFont, this.labelMaxWidth, this.context));
    });

    this.frameRequestId = window.requestAnimationFrame(this.drawFrame.bind(this));

  }

  /**
   * Main animation loop.
   */
  drawFrame(now = 0) {

    const ctx = this.context;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear canvas.

    // Calculate delta since last frame:
    if (this.lastFrame === undefined) {
      this.lastFrame = now;
    }
    const delta = (now - this.lastFrame) / 1000;
    if (delta > 0) {
      this.rotation += delta * this.rotationSpeed;
      this.rotation = this.rotation % 360;
    }
    this.lastFrame = now;

    let currentItem;
    let itemAngle;
    let lastItemAngle; // Record the last angle so we can resume in the next loop.

    // Draw wedges:
    lastItemAngle = this.rotation;
    for (let i = 0; i < this.actualItems.length; i++) {

      itemAngle = this.actualItems[i].weight * this.weightedItemAngle;
      const startAngle = lastItemAngle;
      const endAngle = lastItemAngle + itemAngle;

      ctx.beginPath();
      ctx.moveTo(this.center.x, this.center.y);
      ctx.arc(
        this.center.x,
        this.center.y,
        this.actualRadius,
        util.degRad(startAngle + enums.arcAdjust),
        util.degRad(endAngle + enums.arcAdjust)
      );
      ctx.closePath();

      ctx.fillStyle = this.actualItems[i].backgroundColor;
      ctx.fill();

      if (this.lineWidth > 0) {
        ctx.strokeStyle = this.lineColor;
        ctx.lineWidth = this.lineWidth;
        ctx.lineJoin = 'bevel';
        ctx.stroke();
      }

      lastItemAngle += itemAngle;

      if (util.isAngleBetween(this.pointerRotation, startAngle % 360, endAngle % 360)) {
        currentItem = this.actualItems[i];
      }

    }

    // Set font:
    ctx.textBaseline = 'middle';
    ctx.textAlign = this.itemLabelAlign;
    ctx.font = this.itemLabelFontSize + 'px ' + this.itemLabelFont;
    const itemLabelBaselineOffset = this.itemLabelFontSize * -this.itemLabelBaselineOffset;

    ctx.save();

    // Draw item labels:
    lastItemAngle = this.rotation;
    for (let i = 0; i < this.actualItems.length; i++) {

      itemAngle = this.actualItems[i].weight * this.weightedItemAngle;

      ctx.save();
      ctx.beginPath();

      ctx.fillStyle = this.actualItems[i].labelColor;

      const angle = lastItemAngle + (itemAngle / 2);

      ctx.translate(
        this.center.x + Math.cos(util.degRad(angle + enums.arcAdjust)) * (this.actualRadius * this.itemLabelRadius),
        this.center.y + Math.sin(util.degRad(angle + enums.arcAdjust)) * (this.actualRadius * this.itemLabelRadius)
      );

      ctx.rotate(util.degRad(angle + enums.arcAdjust));

      if (this.debug) {
        ctx.beginPath();
        ctx.strokeStyle = '#ff00ff'
        ctx.lineWidth = 1;
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.labelMaxWidth, 0);
        ctx.stroke();

        ctx.strokeRect(0, -this.itemLabelFontSize/2, -this.labelMaxWidth, this.itemLabelFontSize)
      }

      ctx.rotate(util.degRad(this.itemLabelRotation));

      if (this.actualItems[i].label !== undefined) {
        ctx.fillText(this.actualItems[i].label, 0, itemLabelBaselineOffset);
      }

      ctx.restore();

      lastItemAngle += itemAngle;

    }

    this.drawImageOnCanvas(this.image, false);
    this.drawImageOnCanvas(this.overlayImage, true);

    if (this.rotationSpeed !== 0) {

      // Decrease rotation (simulate drag):
      this.rotationSpeed += (this.rotationResistance * delta) * this.rotationDirection;

      // Prevent rotation from going back the oposite way:
      if (this.rotationDirection === 1 && this.rotationSpeed < 0) {
        this.rotationSpeed = 0;
      } else if (this.rotationDirection === -1 && this.rotationSpeed >= 0) {
        this.rotationSpeed = 0;
      }

      if (this.rotationSpeed === 0) {
        this.onRest?.({
          event: 'rest',
          item: currentItem,
        });
      }

    }

    if (this.debug) {
      // Draw dragMove events:
      if (this.dragMoves && this.dragMoves.length) {
        for (let i = this.dragMoves.length; i >= 0; i--) {
          const point = this.dragMoves[i];
          if (point === undefined) continue;
          let percentFill = i / this.dragMoves.length;
          percentFill = (percentFill -1) * -1;
          percentFill *= 100;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = `hsl(200,100%,${percentFill}%)`;
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 0.5;
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Wait until next frame.
    this.frameRequestId = window.requestAnimationFrame(this.drawFrame.bind(this));

  }

  drawImageOnCanvas(image, isOverlay = false) {

    if (!image) return;

    const ctx = this.context;

    ctx.save();

    ctx.translate(
      this.center.x,
      this.center.y,
    );

    if (!isOverlay) ctx.rotate(util.degRad(this.rotation));

    // Draw the image centered and scaled to fit the wheel's container:
    // For convenience, scale the 'normal' image to the size of the wheel radius
    // (so a change in the wheel radius won't require the image to also be updated).
    const size = isOverlay ? this.size : this.size * this.radius;
    const sizeHalf = -(size / 2);
    ctx.drawImage(
      image,
      sizeHalf,
      sizeHalf,
      size,
      size,
    );

    ctx.restore();

  }

  /**
   * Increase `rotationSpeed by the value of `speed` (randomised by ±15% to make it realistically chaotic).
   */
  spin(speed = 0) {

    const newSpeed = this.rotationSpeed + util.getRandomInt(speed * 0.85, speed * 0.15);

    this.rotationSpeed = newSpeed;

    this.onSpin?.({
      event: 'spin',
      direction: this.rotationDirection,
      rotationSpeed: this.rotationSpeed,
    });

  }

  /**
   * Return 1 for clockwise, -1 for antiClockwise.
   */
  getRotationDirection(speed = 0) {
     return (speed > 0) ? 1 : -1;
  }

  /**
   * Return true if the given point is inside the wheel.
   */
  wheelHitTest(point = {x:0, y:0}) {
    const p = util.translateXYToElement(point, this.canvas);
    return util.isPointInCircle(p, this.center.x, this.center.y, this.actualRadius);
  }

  /**
   * Refresh the cursor state.
   * Call this after the pointer moves.
   */
  refreshCursor() {

    if (this.isDragging) {
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (this.isInteractive && this.isCursorOverWheel) {
      this.canvas.style.cursor = 'grab';
      return;
    }

    this.canvas.style.cursor = null;

  }

  processItems() {

    this.actualItems = [];

    for (let i = 0; i < this.items.length; i++) {

      const item = this.items[i];
      const newItem = {};

      // Background color:
      if (item.backgroundColor) {
        newItem.backgroundColor = item.backgroundColor
      } else if (this.itemBackgroundColors.length) {
        // Use a value from the repeating set:
        newItem.backgroundColor = this.itemBackgroundColors[i % this.itemBackgroundColors.length];
      } else {
        newItem.backgroundColor = '#fff'; // Default.
      }

      // Label:
      if (item.label) {
        newItem.label = item.label;
      } else {
        newItem.label = '';
      }

      // Label Color:
      if (item.labelColor) {
        newItem.labelColor = item.labelColor;
      } else if (this.itemLabelColors.length) {
        // Use a value from the repeating set:
        newItem.labelColor = this.itemLabelColors[i % this.itemLabelColors.length];
      } else {
        newItem.labelColor = '#000'; // Default.
      }

      // Weight:
      if (typeof item.weight === 'number') {
        newItem.weight = item.weight;
      } else {
        newItem.weight = 1;
      };

      this.actualItems.push(newItem);

    }

    if (this.actualItems.length) {
      this.weightedItemAngle = 360 / util.sumObjArray(this.actualItems, 'weight');
    } else {
      this.weightedItemAngle = 0;
    }

  }

  /**
   * Show/hide debugging info.
   * This is particularly helpful when fine-tuning labels.
   */
  get debug () {
    return this._debug;
  }
  set debug(val) {
    if (typeof val !== 'boolean') {
      this._debug = false;
      return;
    }
    this._debug = val;
  }

  get image () {
    return this._image;
  }
  set image(val) {
    if (typeof val !== 'string') {
      this._image = null;
      return;
    }
    this._image = new Image();
    this._image.src = val;
  }

  get offset () {
    return this._offset;
  }
  set offset(val) {
    if (!val) {
      this._offset = {w: 0, h: 0};
      return;
    }
    this._offset = val;
    this.resize();
  }

  get overlayImage () {
    return this._overlayImage;
  }
  set overlayImage(val) {
    if (typeof val !== 'string') {
      this._overlayImage = null;
      return;
    }
    this._overlayImage = new Image();
    this._overlayImage.src = val;
  }

  /**
   * The `items` to show on the wheel.
   */
  get items () {
    return this._items;
  }
  set items(val) {
    if(!Array.isArray(val)) {
      this._items = [];
      this._weightedItemAngle = 0;
      return;
    }
    this._items = val;
    this.processItems();
  }

  /**
   * The repeating pattern of colors that will be used for each item's `backgroundColor`.
   * Is overridden by `item.backgroundColor`.
   * Example: `['#fff','#000']`.
   */
  get itemBackgroundColors () {
    return this._itemBackgroundColors;
  }
  set itemBackgroundColors(val) {
    if(!Array.isArray(val)) {
      this._temBackgroundColors = [];
      return;
    }
    this._itemBackgroundColors = val;
    this.processItems();
  }

  /**
   * The alignment of each `item.label`.
   * Is overridden by `item.labelColor`.
   * Accepted vlaues: `'left'`|`'center'`|`'right'`.
   * If you change this to `'left'`, you will also need to set `itemLabelRotation` to `180°`.
   */
  get itemLabelAlign () {
    return this._itemLabelAlign;
  }
  set itemLabelAlign(val) {
    if(typeof val !== 'string') {
      this._itemLabelAlign = enums.AlignText.right;
      return;
    }
    this._itemLabelAlign = val;
  }

  /**
   * The maximum font size to draw each `item.label`.
   * The actual font size will be calculated dynamically so that the longest label of all
   * the items fits within `itemLabelRadiusMax` and the font size is below `itemLabelFontSizeMax`.
   */
  get itemLabelFontSizeMax () {
    return this._itemLabelFontSizeMax;
  }
  set itemLabelFontSizeMax(val) {
    if(typeof val !== 'number') {
      this._itemLabelFontSizeMax = 100;
      return;
    }
    this._itemLabelFontSizeMax = val;
  }

  /**
   * The point along the radius (as a percent, starting from the inside of the circle) to
   * start drawing each `item.label`.
   */
  get itemLabelRadius () {
    return this._itemLabelRadius;
  }
  set itemLabelRadius(val) {
    if(typeof val !== 'number') {
      this._itemLabelRadius = 0.85;
      return;
    }
    this._itemLabelRadius = val;
  }

  /**
   * The point along the radius (as a percent, starting from the inside of the circle) to
   * resize each `item.label` (to fit) if it is too wide.
   */
  get itemLabelRadiusMax () {
    return this._itemLabelRadiusMax;
  }
  set itemLabelRadiusMax(val) {
    if(typeof val !== 'number') {
      this._itemLabelRadiusMax = 0.2;
      return;
    }
    this._itemLabelRadiusMax = val;
  }

  /**
   * Use this to flip `item.label` `180°` when changing `itemLabelAlign`.
   */
  get itemLabelRotation () {
    return this._itemLabelRotation;
  }
  set itemLabelRotation(val) {
    if(typeof val !== 'number') {
      this._itemLabelRotation = 0;
      return;
    }
    this._itemLabelRotation = val;
  }

  /**
   * The repeating pattern of colors that will be used for each item's `labelColor`.
   * Is overridden by `item.labelColor`.
   * Example: `['#fff','#000']`.
   */
  get itemLabelColors () {
    return this._itemLabelColors;
  }
  set itemLabelColors(val) {
    if(!Array.isArray(value)) {
      this._itemLabelColors = [];
      return;
    }
    this._itemLabelColors = val;
    this.processItems();
  }

  /**
   * The font family of each `item.labelFont`.
   * Is overridden by `item.labelFont`.
   * Example: `'sans-serif'`.
   */
  get itemLabelFont () {
    return this._itemLabelFont;
  }
  set itemLabelFont(val) {
    if(typeof val !== 'string') {
      this._itemLabelFont = 'sans-serif';
      return;
    }
    this._itemLabelFont = val;
    this.resize();
  }

  /**
   * Offset the baseline (or line height) of each `item.label` as a percentage of the label's height.
   */
  get itemLabelBaselineOffset () {
    return this._itemLabelBaselineOffset;
  }
  set itemLabelBaselineOffset(val) {
    if(typeof val !== 'number') {
      this._itemLabelBaselineOffset = 0;
      return;
    }
    this._itemLabelBaselineOffset = val;
    this.resize();
  }

  /**
   * Enable/disable the feature that lets the user spin the wheel using click-drag/touch-flick.
   */
  get isInteractive () {
    return this._isInteractive;
  }
  set isInteractive(val) {
    if (typeof val !== 'boolean') {
      this._isInteractive = true;
      return;
    }
    this._isInteractive = val;
  }

  /**
   * The color of the lines between each item.
   */
  get lineColor () {
    return this._lineColor;
  }
  set lineColor(val) {
    if (typeof val !== 'string') {
      this._lineColor = '#000';
      return;
    }
    this._lineColor = val;
  }

  /**
   * The width of the lines between each item.
   */
  get lineWidth () {
    return this._lineWidth;
  }
  set lineWidth(val) {
    if (typeof val !== 'number') {
      this._lineWidth = 1;
      return;
    }
    this._lineWidth = val;
  }

  /**
   * The maximum value for `rotationSpeed`.
   * The wheel will not spin faster than this.
   */
  get maxRotationSpeed () {
    return this._maxRotationSpeed;
  }
  set maxRotationSpeed(val) {
    if (typeof val !== 'number') {
      this._maxRotationSpeed = 250;
      return;
    }
    this._maxRotationSpeed = val;
  }

  /**
   * The callback for the `onRest` event.
   */
  get onRest () {
    return this._onRest;
  }
  set onRest(val) {
    if (typeof val !== 'function') {
      this._onRest = null;
      return;
    }
    this._onRest = val;
  }

  /**
   * The callback for the `onSpin` event.
   */
  get onSpin () {
    return this._onSpin;
  }
  set onSpin(val) {
    if (typeof val !== 'function') {
      this._onSpin = null;
      return;
    }
    this._onSpin = val;
  }

  /**
   * The angle of the pointer which is used to determine the "winning" item.
   * 0 is north.
   */
  get pointerRotation () {
    return this._pointerRotation;
  }
  set pointerRotation(val) {
    if (typeof val !== 'number') {
      this._pointerRotation = 0;
      return;
    }
    this._pointerRotation = val;
  }

  /**
   * The radius of the wheel as a percent of the container's smallest dimension.
   */
  get radius () {
    return this._radius;
  }
  set radius(val) {
    if (typeof val !== 'number') {
      this._radius = 0.95;
      return;
    }
    this._radius = val;
    this.resize();
  }

  /**
   * The rotation speed of the wheel.
   * Pass a positive number to spin clockwise, or a negative number to spin antiClockwise.
   * The further away from 0 the faster it will spin.
   */
  get rotationSpeed () {
    return this._rotationSpeed;
  }
  set rotationSpeed(val) {
    if (typeof val !== 'number') {
      this._rotationDirection = 0;
      this._rotationSpeed = 0;
      return;
    }

    // Limit speed to `this.maxRotationSpeed`
    let newSpeed = Math.min(val, this._maxRotationSpeed);
    newSpeed = Math.max(newSpeed, -this._maxRotationSpeed);

    this._rotationDirection = this.getRotationDirection(newSpeed);
    this._rotationSpeed = newSpeed;
  }

  /**
   * How much to reduce `rotationSpeed` by every second.
   */
  get rotationResistance () {
    return this._rotationResistance;
  }
  set rotationResistance(val) {
    if (typeof val !== 'number') {
      this._rotationResistance = -35;
      return;
    }
    this._rotationResistance = val;
  }

  /**
   * The rotation (angle in degrees) of the wheel.
   * 0 is north. `item[0]` will be drawn clockwise from this point.
   */
  get rotation () {
    return this._rotation;
  }
  set rotation(val) {
    if (typeof val !== 'number') {
      this._rotation = 0;
      return;
    }
    this._rotation = val;
  }

  /**
   * Get the angle (in degrees) of the given point from the center of the wheel.
   * 0 is north.
   */
  getAngleFromCenter(point = {x:0, y:0}) {
    return (util.getAngle(this.center.x, this.center.y, point.x, point.y) + 90) % 360;
  }

  /**
   * Enter the drag state.
   */
  dragStart(point = {x:0, y:0}) {

    const p = util.translateXYToElement(point, this.canvas);

    this.isDragging = true; // Bool to indicate we are currently dragging.

    this.rotationSpeed = 0; // Stop the wheel from spinning.

    const a = this.getAngleFromCenter(p);

    this.dragDelta = util.addAngle(this.rotation, -a); // Used later in dragMove.
    this.dragMoves = []; // Initalise.
    this.dragLastPoint = {
      x: p.x,
      y: p.y,
    };

    this.refreshCursor();

  }

  /**
   * Animate the wheel to follow the pointer while dragging.
   * Save the drag events for later.
   */
  dragMove(point = {x:0, y:0}) {

    const p = util.translateXYToElement(point, this.canvas);
    const a = this.getAngleFromCenter(p);

    // Calc new rotation:
    const newRotation = util.addAngle(a, this.dragDelta);

    // Calc direction:
    const aFromLast = util.addAngle(a, -this.getAngleFromCenter(this.dragLastPoint));
    const direction = (aFromLast < 180) ? 1 : -1;

    // Calc distance:
    const distance = util.getDistanceBetweenPoints(p, this.dragLastPoint) * direction;

    // Save data for use in dragEnd event.
    this.dragMoves.unshift({
      distance,
      x: p.x,
      y: p.y,
      now:performance.now(),
    });

    this.dragMoves.length = 50; // Truncate array to keep it small.

    this.rotation = newRotation; // Snap the rotation to the drag start point.

    this.dragLastPoint = {
      x: p.x,
      y: p.y,
    };

  }

  /**
   * Exit the drag state.
   * Set the rotation speed so the wheel continues to spin in the same direction.
   */
  dragEnd() {

    this.isDragging = false;
    this.dragDelta = null;
    clearInterval(this.dragClearOldDistances);

    // Calc the drag distance:
    let dragDistance = 0;
    const now = performance.now();
    this.dragMoves = this.dragMoves.reduce((result, value) => {

      // Ignore old dragMove events (so the user can cancel the drag by not moving for a short time).
      if (value !== undefined && now - value.now < 250) {
        dragDistance += value.distance * 1.5;
        result.push(value);
      }

      return result;

    }, []);

    // Spin the wheel:
    if (dragDistance !== 0) {

      this.rotationSpeed = dragDistance;

      this.onSpin?.({
        event: 'spin',
        direction: this.rotationDirection,
        rotationSpeed: this.rotationSpeed,
        dragMoves: this.dragMoves,
      });

    }

    this.refreshCursor();

  }

}
