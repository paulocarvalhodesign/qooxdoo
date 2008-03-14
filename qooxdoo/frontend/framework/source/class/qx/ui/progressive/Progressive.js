/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2008 Derrell Lipman

   License:
     LGPL: http://www.gnu.org/licenses/lgpl.html
     EPL: http://www.eclipse.org/org/documents/epl-v10.php
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Derrell Lipman (derrell)

************************************************************************ */

/* ************************************************************************

#module(ui_progressive)

************************************************************************ */

/**
 * Progressive Renderer.  EXPERIMENTAL!  INTERFACE MAY CHANGE.
 */
qx.Class.define("qx.ui.progressive.Progressive",
{
  extend : qx.ui.layout.VerticalBoxLayout,


  /**
   */
  construct : function(structure)
  {
    this.base(arguments);

    // Create an object in which we'll track renderers that have been added
    this._renderer = { };

    // We want to use a Vertical Box Layout for our pane
    this.set(
      {
        left            : 20,
        top             : 20,
        right           : 20,
        bottom          : 20,
        spacing         : 0,
        border          : new qx.ui.core.Border(1, "solid", "#dddddd"),
        overflow        : "hidden",
        backgroundColor : "white"
      });

    // Prepare our displayable structure
    this._structure = structure;
    structure.applyStructure(this);

    // We've not yet done our initial render
    this.__bInitialRenderComplete = false;

    // We're not currently rendering
    this.__bRendering = false;

    // Number of elements available to be rendered.  Useful for progress
    // handlers, e.g. a progress bar or status counter.
    this.__initialNumElements = 0;
  },


  events :
  {
    /**
     * Event fired when rendering begins.  The event data is the number of
     * elements currently queued to be rendered.
     */
    "renderStart" : "qx.event.type.DataEvent",

    /**
     * Event fired when rendering ends.
     */
    "renderEnd"   : "qx.event.type.Event",

    /**
     * This event is fired after each batch of elements is rendered, and
     * control is about to be yielded to the browser.  This is an appropriate
     * event to listen for, to implement a progress bar.
     *
     * The event data is an object with the following members:
     * <dl>
     *   <dt>initial</dt>
     *   <dd>
     *     The number of elements that were available at the start of this
     *     rendering request.
     *   </dd>
     *
     *   <dt>remaining</dt>
     *   <dd>
     *     The number of elements still remaining to be rendered.
     *   </dd>
     * </dl>
     */
    "progress" : "qx.event.type.DataEvent",

    /**
     * This event is fired after each element is rendered.
     *
     * The event data is an object with the following members:
     * <dl>
     *   <dt>initial</dt>
     *   <dd>
     *     The number of elements that were available at the start of this
     *     rendering request.
     *   </dd>
     *
     *   <dt>remaining</dt>
     *   <dd>
     *     The number of elements still remaining to be rendered.
     *   </dd>
     *
     *   <dt>element</dt>
     *   <dd>
     *     The object, returned by the data model's getNextElement() method,
     *     that was just rendered.
     *   </dd>
     * </dl>
     *
     * Note: Unless batchSize is set to 1 or we happen to be at the end of a
     *       batch, widgets will not be rendered at this time.  Use this event
     *       for programmatically processing rendered elements, but not for
     *       such things as progress bars.  Instead, where only user-visible
     *       changes such as progress bars are being updated, use the
     *       "progress" event.
     */
    "progressDetail" : "qx.event.type.DataEvent"
  },


  statics :
  {
    /**
     */
  },


  properties :
  {
    /** The data model. */
    dataModel :
    {
      apply : "_applyDataModel"
    },

    /**
     * Number of elements to render at one time.  After this number of
     * elements has been rendered, control will be yielded to the browser
     * allowing the elements to actually be displayed.  A short-interval
     * timer will be set to cause remaining of the next batch of elements.
     */
    batchSize :
    {
      init  : 20
    }
  },


  members :
  {

    /**
     * @type member
     * @param value {var} Current value
     * @param old {var} Previous value
     */
    addRenderer : function(name, renderer)
    {
      this._renderer[name] = renderer;
    },

    removeRenderer : function(name)
    {
      delete this._renderer[name];
    },

    getPane : function()
    {
      return this._pane;
    },

    getHeader : function()
    {
      return this._header;
    },

    getFooter : function()
    {
      return this._footer;
    },

    render : function()
    {
      // Prevent render calls while we're already rendering
      if (this.__bRendering)
      {
        return;
      }

      this.__bRendering = true;

      var element;
      var renderer;
      var state =
      {
        // The data model
        model          : this.getDataModel(),

        // The widget in which the element data should be rendered
        pane           : this._structure.getPane(),

        // How many elements are rendered at a time, before yielding to the
        // browser
        batchSize      : this.getBatchSize(),

        // Add a place for renderers' private data.  If multiple renderers are
        // being used, each renderer should place its own private data in the
        // the state object area reserved for that renderer's use:
        // state.rendererData[element.renderer].
        rendererData   : this.__createStateRendererData()
      };

      // Record render start time
      this.__t1 = new Date();

      // Render the first batch of elements.  Subsequent batches will be via
      // timer started from this.__renderElementBatch().
      if (this.__bInitialRenderComplete)
      {
        // Get the starting number of elements
        this.__initialNumElements = state.model.getElementCount();

        // Let listeners know we're beginning to render
        this.createDispatchDataEvent("renderStart", this.__initialNumElements);

        // Begin rendering
        this.__renderElementBatch(state);
      }
      else
      {
        // Ensure we leave enough time that 'this' has been rendered, so that
        // this.getElement() is valid and has properties.  It's needed by some
        // renderers.
        //
        // FIXME: Why isn't an event listener for "appear" an adequate delay???
        //        (It's done with a timer like this in Table's Pane too.)
        qx.client.Timer.once(function()
                             {
                               this.__initialNumElements =
                                 state.model.getElementCount();
                               this.createDispatchDataEvent("renderStart",
                                                            this.__initialNumElements);
                               this.__renderElementBatch(state);
                               this.__bInitialRenderComplete = true;
                             },
                             this, 10);
      }
    },

    _applyDataModel : function(value, old)
    {
      if (old)
      {
        // Remove the old event listener
        old.removeEventListener("dataAvailable", this.__dataAvailable, this);

        // Dispose the old model
        old.dispose();
      }

      // Add an event listener so we know when data is available in the model
      value.addEventListener("dataAvailable", this.__dataAvailable, this);
    },

    __renderElementBatch : function(state)
    {
      var current;
      var element;

      for (var i = state.batchSize; i > 0; i--)
      {
        // Retrieve the current element
        current = state.model.getNextElement();
        if (! current)
        {
          // No more elements.  We're done.
          this.debug("Render time: " + (new Date() - this.__t1) + "ms");
          this.__bRendering = false;

          // Notify any progress handlers that are listening
          this.createDispatchEvent("renderEnd");

          return;
        }

        // Get the element member
        element = current.element;

        // Get the element's renderer
        renderer = this._renderer[element.renderer];

        // Render this element
        renderer.render(state, element);

        // Notify any progress detail handlers that are listening
        this.createDispatchDataEvent("progressDetail",
                                     {
                                       initial   : this.__initialNumElements,
                                       remaining : current.remaining,
                                       element   : element
                                     });
      }

      // Notify any progress handlers that are listening
      this.createDispatchDataEvent("progress",
                                   {
                                     initial   : this.__initialNumElements,
                                     remaining : current.remaining
                                   });

      // Set a timer to render the next element
      qx.client.Timer.once(function()
                           {
                             this.__renderElementBatch(state);
                           },
                           this, 0);
    },

    __createStateRendererData : function()
    {
      var rendererData = { };

      for (var name in this._renderer)
      {
        rendererData[name] = { };
      }

      return rendererData;
    },

    __dataAvailable : function(e)
    {
      this.__initialNumElements = e.getData();
      this.render();
    }
  },


  /**
   */
  destruct : function()
  {
    this._disposeFields("_renderer");
  }
});
