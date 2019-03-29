function InfiniteVirtualList(settings, $container, $scrollKeeper) {
    const list = this;

    list.id = newGuid();
    list.$container = $container;
    list.$scrollKeeper = $scrollKeeper;

    list.settings = settings;
    list.items = [];
    list.maxItemsNumber = settings.maxItemsNumber;
    list.attached = false; // public functions should check this property before execution

    list.itemHeight = 200;
    list.itemHeightHalf = 100;
    list.itemContainerHeight = list.itemHeight * list.maxItemsNumber;
    list.offset = 0;
    list.center = 0; // half of the viewport's height
    list.lastUsedOffset = 0;
    list.scrollThreshold = list.itemHeightHalf;
    list.preloadItems = 3; // amount of months before or after the visible month in the center of the viewport

    list.cssClasses = {
        Item: "ivl-item",
        ItemCollapsed: "ivl-item-collapsed"
    };

    list.dataAttr = {
        hasScrollHandlersMarker: "ivl-has-scroll-handlers-" + list.id,
        itemIndex: "item-i"
    };

    list.spaceHolderType = {top: "top", bottom: "bottom"};

    list.eventNamespace = ".ivl-event-" + list.id;

    list._getScrollingElem = (elem) => {
        return elem.scrollingElement || elem;
    };

    list._getViewportCenter = function () {
        return list.center || (list.center = Math.floor(list._getScrollingElem(list.$scrollKeeper[0]).clientHeight / 2));
    };

    list._getItemIndexByOffset = function (offset) {
        let index = Math.floor(offset / list.itemHeight);
        return Math.max(Math.min(index, list.maxItemsNumber - 1), 0);
    };

    list._getCentralItemIndex = () => {
        let center = list._getViewportCenter(),
            centralItemIndex = list._getItemIndexByOffset(list.offset - list.$container[0].offsetTop + center);

        return centralItemIndex;
    };

    // index - the item that should be estimated as visible or not.
    list._isShowItem = function (index) {
        let centralItem = list._getCentralItemIndex(),
            preloadI = list.preloadItems;
        return centralItem === index // is shown month
            || Math.abs(centralItem - index) <= preloadI; // is prev months or next months
    };

    list._calcSpaceHolderHeight = function (type) {
        let height = 0,
            iItem = list._getCentralItemIndex(),
            preloadI = list.preloadItems;

        switch (type) {
            case list.spaceHolderType.top: {
                let topItemsCount = Math.max(iItem - preloadI, 0);
                height = list.itemHeight * topItemsCount;
                break;
            }
            case list.spaceHolderType.bottom: {
                let bottomItemsCount = Math.max((list.maxItemsNumber - (iItem + preloadI + 1)), 0);
                height = list.itemHeight * bottomItemsCount;
                break;
            }
        }

        return height;
    };

    list._updateVisibleItems = function () {
        let topHeight = list._calcSpaceHolderHeight(list.spaceHolderType.top),
            bottomHeight = list._calcSpaceHolderHeight(list.spaceHolderType.bottom),
            collapseItemCss = list.cssClasses.ItemCollapsed;

        $("[data-spaceholder-type='top']", list.$container).height(topHeight + "px");
        $("[data-spaceholder-type='bottom']", list.$container).height(bottomHeight + "px");

        $("." + list.cssClasses.Item, list.$container).each(function (index, itemElem) {
            let $itemElem = $(itemElem);
            if (list._isShowItem($itemElem.data(list.dataAttr.itemIndex))) {
                $itemElem.removeClass(collapseItemCss);
            } else if (!$itemElem.hasClass(collapseItemCss)) {
                $itemElem.addClass(collapseItemCss);
            }
        });
    };

    list._attachScrollHandlers = function () {
        let $container = list.$container;

        if ($container.data(list.dataAttr.hasScrollHandlersMarker)) {
            return;
        }

        let scrollHandler = function (elem) {
            let lastOffset = list.lastUsedOffset;
            let offset = Math.max(elem.scrollTop, 0);
            list.offset = offset;

            if (Math.abs(offset - lastOffset) >= list.scrollThreshold) {
                console.log("offset: " + list.offset);
                list.lastUsedOffset = offset;
                list._updateVisibleItems();
            }
        };

        $scrollKeeper.on("scroll" + list.eventNamespace, function (event) {
            scrollHandler(list._getScrollingElem(event.currentTarget));
        });

        $scrollKeeper.on("touchmove" + list.eventNamespace, function () {
            scrollHandler(list._getScrollingElem(this));
        });

        $container.data(list.dataAttr.hasScrollHandlersMarker, true);
    };

    list._appendItem = function (itemHtml) {
        $("[data-spaceholder-type='bottom']", list.$container).before(itemHtml);
    };

    list._prependItem = function (itemHtml) {
        $("[data-spaceholder-type='top']", list.$container).after(itemHtml);
    };

    list._generateItem = function (index) {
        let itemHtml = list.settings.generateItemHtml(index),
            centerOffset = list._getViewportCenter(),
            centerIndex = list._getItemIndexByOffset(centerOffset);

        var itemPosition = index < centerIndex ? list.spaceHolderType.top : list.spaceHolderType.bottom;

        switch (itemPosition) {
            case list.spaceHolderType.top: {
                list._prependItem(itemHtml);
                break;
            }
            case list.spaceHolderType.bottom: {
                list._appendItem(itemHtml);
                break;
            }
        }
    };

    list._renderAllItems = function (items) {
        let itemsHtml = "";

        items.forEach((item, index) => {
            let itemHtml = list.settings.generateItemHtml(item);
            itemsHtml += itemHtml;
        });

        return itemsHtml;
    };

    list._detachScrollHandlers = function () {
        list.$container.off(list.eventNamespace);
        list.$container.data(list.hasScrollHandlersMarker, false);
    };

    list._clearElements = function () {
        $("." + list.cssClasses.Item, list.$container).removeClass(list.cssClasses.ItemCollapsed);
        $("[data-spaceholder-type]", list.$container).remove();
    };
}

InfiniteVirtualList.prototype.isScrolledToBottom = scrollableElem => {
    return scrollableElem.scrollHeight - scrollableElem.scrollTop === scrollableElem.clientHeight;
};

InfiniteVirtualList.prototype.isScrolledToTop = scrollableElem => {
    return scrollableElem.scrollTop === 0;
};

InfiniteVirtualList.prototype.scrollToElem = (scrollableElem, element, offset) => {
    return scrollableElem.scrollTop = element.offsetTop - offset;
};

InfiniteVirtualList.prototype.scrollToOffset = (scrollableElem, offset) => {
    return scrollableElem.scrollTop = offset;
};

InfiniteVirtualList.prototype.populate = function (items) {
    let height = this._calcSpaceHolderHeight(this.spaceHolderType.top);
    let spaceHolder = "<div data-spaceholder-type='top' style='width:100%; height:" + height + "px'></div>";

    this.$container.append(spaceHolder);

    let itemsHtml = this._renderAllItems(items);

    this.$container.append(itemsHtml);

    height = this._calcSpaceHolderHeight(this.spaceHolderType.bottom);
    spaceHolder = "<div data-spaceholder-type='bottom' style='width:100%; height:" + height + "px'></div>";

    this.$container.append(spaceHolder);

    this._updateVisibleItems();
};

InfiniteVirtualList.prototype.onHeightChanged = function () {
    this.center = 0;
};

InfiniteVirtualList.prototype.attach = function () {
    if (this.attached)
        return;

    this._attachScrollHandlers();
};

InfiniteVirtualList.prototype.detach = function () {
    if (!this.attached)
        return;// clear element and detach events

    this._detachScrollHandlers();
    this._clearElements();

    // clear properties
    // set to 0 to be recalculated after next attaching.
    this.center = 0;

    this.attached = false;
};

function DatepickerScroller() {
    InfiniteVirtualList.apply(this, arguments);

}

DatepickerScroller.prototype = Object.create(InfiniteVirtualList.prototype);
DatepickerScroller.prototype.constructor = DatepickerScroller;
