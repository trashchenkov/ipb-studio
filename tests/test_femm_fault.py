"""Static regression tests for per-phase FEMM Lua generation (FEMM solver not run here)."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = json.loads((ROOT / "femm/example_job.json").read_text(encoding="utf-8"))

class FaultGeneratorTests(unittest.TestCase):
    def generate(self, job):
        with tempfile.TemporaryDirectory() as td:
            d = Path(td)
            p = d / "source.json"
            p.write_text(json.dumps(job), encoding="utf-8")
            completed = subprocess.run(
                [sys.executable, str(ROOT / "femm/generate.py"), "--job", str(p), "--outdir", str(d)],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
            )
            if completed.returncode:
                return completed.returncode, completed.stdout + completed.stderr
            return 0, (d / ("case_" + job["electrical"]["mode"] + ".lua")).read_text(encoding="utf-8")

    def fault_job(self):
        j = json.loads(json.dumps(BASE))
        j["electrical"]["phase_current_rms_A"] = 10000
        j["electrical"]["fault_phasors_rms_A"] = [
            {"re": 10000, "im": 0},
            {"re": -10000, "im": 0},
            {"re": 0, "im": 0},
        ]
        j["fault_case"] = {"type":"harmonic_section","scenario":"test","section":"test"}
        return j

    def test_baseline_still_generates(self):
        code, text = self.generate(BASE)
        self.assertEqual(code, 0, text)
        self.assertIn("mi_addcircprop", text)
        self.assertIn("forces_bonded.csv", text)

    def test_two_phase_balanced_current_and_zero_third(self):
        code, text = self.generate(self.fault_job())
        self.assertEqual(code, 0, text)
        self.assertIn('mi_addcircprop("phase_1",(14142.1356237+I*(0)),1)', text)
        self.assertIn('mi_addcircprop("phase_2",(-14142.1356237+I*(0)),1)', text)
        self.assertIn('mi_addcircprop("phase_3",(0+I*(0)),1)', text)
        self.assertIn("mo_blockintegral(11)", text)
        self.assertIn("mo_blockintegral(13)", text)
        self.assertIn("mo_blockintegral(14)", text)

    def test_unbalanced_fault_input_rejected(self):
        j = self.fault_job()
        j["electrical"]["fault_phasors_rms_A"][1]["re"] = -8000
        code, msg = self.generate(j)
        self.assertNotEqual(code, 0)
        self.assertIn("balance", msg)

    def test_fault_requires_provenance(self):
        j = self.fault_job()
        j.pop("fault_case")
        code, msg = self.generate(j)
        self.assertNotEqual(code, 0)
        self.assertIn("Expected explicit", msg)

    def test_shell_modes(self):
        j = self.fault_job()
        j["electrical"]["mode"] = "isolated"
        code, text = self.generate(j)
        self.assertEqual(code, 0, text)
        self.assertIn('mi_addcircprop("isolated_shell_3",0,0)', text)

if __name__ == "__main__":
    unittest.main()
