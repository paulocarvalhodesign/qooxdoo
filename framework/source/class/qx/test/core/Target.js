/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2007-2008 1&1 Internet AG, Germany, http://www.1und1.de

   License:
     LGPL: http://www.gnu.org/licenses/lgpl.html
     EPL: http://www.eclipse.org/org/documents/epl-v10.php
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Fabian Jakobs (fjakobs)

************************************************************************ */

/* ************************************************************************
#ignore(qx.Event)
************************************************************************ */
/**
 * @ignore(qx.Event)
 */

qx.Class.define("qx.test.core.Target",
{
  extend : qx.dev.unit.TestCase,

  members :
  {
    testEvents : function()
    {
      qx.Class.define("qx.Event",
      {
        extend : qx.core.Object,
        events : { "click" : "qx.event.type.Event" }
      });

      var target = new qx.Event();
      target.addListener("click", function() {});
      target.dispose();
    }
  }
});
