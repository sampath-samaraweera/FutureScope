"""
Loads stock_prediction_model.pt (a PyTorch checkpoint: {state_dict, config,
model_name: "HybridRNNBiLSTM"}), NOT a Keras model -- this replaces an
earlier version of this file that (incorrectly, for this checkpoint) loaded
via keras.models.load_model().

IMPORTANT CAVEAT: the checkpoint has no accompanying model-class source, so
HybridRNNBiLSTM below is a reconstruction from the state_dict's tensor
shapes plus the saved config, not a copy of original training code. The
layer shapes are exactly right (the state_dict loads with no key/shape
mismatches), but the *forward-pass wiring* (dropout placement, whether
dense-layer activations are tanh, using final hidden states vs. pooling)
is inferred, not confirmed. If you have the original model-definition code,
replace this class with it and re-verify predictions.
"""
from pathlib import Path
from threading import Lock

import torch
import torch.nn as nn

MODEL_PATH = Path(__file__).resolve().parent.parent / "stock_prediction_model.pt"

_model = None
_lock = Lock()


class HybridRNNBiLSTM(nn.Module):
    def __init__(self, n_features=45, rnn_units=(128, 64), bilstm_units=(128, 64),
                 dense_units=(128, 64), dropout=0.3, n_outputs=5):
        super().__init__()
        self.rnn1 = nn.RNN(n_features, rnn_units[0], batch_first=True, nonlinearity="tanh")
        self.rnn2 = nn.RNN(rnn_units[0], rnn_units[1], batch_first=True, nonlinearity="tanh")
        self.bilstm1 = nn.LSTM(n_features, bilstm_units[0], batch_first=True, bidirectional=True)
        self.bilstm2 = nn.LSTM(bilstm_units[0] * 2, bilstm_units[1], batch_first=True, bidirectional=True)
        self.dense1 = nn.Linear(rnn_units[1] + bilstm_units[1] * 2, dense_units[0])
        self.bn1 = nn.BatchNorm1d(dense_units[0])
        self.dense2 = nn.Linear(dense_units[0], dense_units[1])
        self.bn2 = nn.BatchNorm1d(dense_units[1])
        self.output_layer = nn.Linear(dense_units[1], n_outputs)
        self.dropout = nn.Dropout(dropout)
        self.activation = torch.tanh

    def forward(self, x):
        rnn_out, _ = self.rnn1(x)
        _, h_rnn2 = self.rnn2(rnn_out)
        rnn_final = h_rnn2.squeeze(0)  # (batch, rnn_units[1])

        lstm_out, _ = self.bilstm1(x)
        _, (h_lstm2, _) = self.bilstm2(lstm_out)
        lstm_final = torch.cat([h_lstm2[0], h_lstm2[1]], dim=1)  # (batch, bilstm_units[1]*2)

        combined = torch.cat([rnn_final, lstm_final], dim=1)
        out = self.dropout(self.activation(self.bn1(self.dense1(combined))))
        out = self.dropout(self.activation(self.bn2(self.dense2(out))))
        return self.output_layer(out)


class _KerasLikeWrapper:
    """Exposes .predict(x, verbose=0) like a Keras model, so main.py (written
    against the Keras API) needs no changes for the PyTorch swap."""

    def __init__(self, torch_model: nn.Module):
        self._model = torch_model

    def predict(self, x, verbose=0):
        with torch.no_grad():
            return self._model(torch.as_tensor(x, dtype=torch.float32)).numpy()


def get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
                cfg = checkpoint["config"]
                torch_model = HybridRNNBiLSTM(
                    n_features=cfg["n_features"],
                    rnn_units=cfg["rnn_units"],
                    bilstm_units=cfg["bilstm_units"],
                    dense_units=cfg["dense_units"],
                    dropout=cfg["dropout"],
                )
                torch_model.load_state_dict(checkpoint["state_dict"])
                torch_model.eval()
                _model = _KerasLikeWrapper(torch_model)
    return _model
