import { resetAll, getSession } from '../Shared/Session';
import { showMessage } from '../Shared/Ui';

/**
 * App launch: reset client state and initialize the OData service.
 * The service MUST be initialized before any read or CallFunction.
 */
export default function OnLaunch(context) {
    resetAll();
    return context.executeAction('/mdk/Actions/Service/InitializeService.action')
        .then(function () {
            getSession().initialized = true;
        })
        .catch(function (err) {
            const msg = String(err && err.message ? err.message : err);
            return showMessage(context,
                'Could not connect to the Warehouse Lens service. ' +
                'Availability checks and request submission need a connection. ' +
                'Check your network and restart the app.\n\nDetails: ' + msg,
                'No connection');
        });
}
