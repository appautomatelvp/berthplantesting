const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { Link, useLocation, useNavigate } from 'react-router-dom';",
  "import { Link, useLocation, useNavigate } from 'react-router-dom';\nimport { doc, onSnapshot, setDoc } from 'firebase/firestore';\nimport debounce from 'lodash.debounce';\nimport { auth, db, signInAnonymousUser, STATE_COLLECTION, STATE_DOC_ID } from './lib/firebase';"
);

// 2. Add isRemoteUpdate ref
code = code.replace(
  "    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, []);",
  "    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, []);\n\n  const isRemoteUpdate = useRef(false);"
);

// 3. Add Firebase sync hooks
const hooks = 
  useEffect(() => {
    let unsubscribe = () => {};
    signInAnonymousUser().then(() => {
      const stateDoc = doc(db, STATE_COLLECTION, STATE_DOC_ID);
      unsubscribe = onSnapshot(stateDoc, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          isRemoteUpdate.current = true;
          if (data.terminal) setTerminal(data.terminal);
          if (data.metrics) setMetrics(data.metrics);
          if (data.services) setServicesState(withServiceColors(data.services));
          if (data.equipment) setEquipment(data.equipment);
          if (data.cranes) setCranes(data.cranes);
          if (data.lockZones) setLockZones(data.lockZones);
          if (data.secondaryBerth) setSecondaryBerth(data.secondaryBerth);
          if (data.externalBerths) setExternalBerths(data.externalBerths);
          
          setTimeout(() => {
            isRemoteUpdate.current = false;
          }, 100);
        }
      });
    }).catch(console.error);
    return () => unsubscribe();
  }, []);

  const pushToFirebase = useMemo(
    () =>
      debounce((data) => {
        if (!isRemoteUpdate.current) {
          const stateDoc = doc(db, STATE_COLLECTION, STATE_DOC_ID);
          setDoc(stateDoc, data, { merge: true }).catch(console.error);
        }
      }, 500),
    []
  );

  useEffect(() => {
    const snapObj = {
      terminal,
      metrics,
      services,
      equipment,
      cranes,
      lockZones,
      secondaryBerth,
      externalBerths,
    };
    const snap = JSON.stringify(snapObj);
    if (dataSkips.current > 0) {
      dataSkips.current -= 1;
      dataBaseline.current = snap;
      return;
    }
    if (snap !== dataBaseline.current) {
      dataDirty.current = true;
      dataBaseline.current = snap;
      if (!isRemoteUpdate.current) {
        pushToFirebase(snapObj);
      }
    }
  }, [terminal, metrics, services, equipment, cranes, lockZones, secondaryBerth, externalBerths, pushToFirebase]);
;

code = code.replace(
  "  const isRemoteUpdate = useRef(false);",
  "  const isRemoteUpdate = useRef(false);\n" + hooks
);

fs.writeFileSync('src/App.jsx', code);
