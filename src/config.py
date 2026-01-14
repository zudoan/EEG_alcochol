import os


RANDOM_STATE = 42
FS = 256
N_SAMPLES = 256

BANDS = {
    'delta': (0.5, 4),
    'theta': (4, 8),
    'alpha': (8, 13),
    'beta': (13, 30),
    'gamma': (30, 45),
}

DEFAULT_TRAIN_GLOB = 'SMNI_CMI_TRAIN/Train/*.csv'
DEFAULT_TEST_GLOB = 'SMNI_CMI_TEST/Test/*.csv'

REMOVE_TEST_DUPLICATES = True
MAX_FILES_TRAIN = None
MAX_FILES_TEST = None

SAVE_DIR = 'saved_models'

GRIDSEARCH_CV_SPLITS = int(os.environ.get('GRIDSEARCH_CV_SPLITS', '2'))
RUN_TF_MODELS = os.environ.get('RUN_TF_MODELS', '0').strip() == '1'
RUN_TORCH_MODELS = os.environ.get('RUN_TORCH_MODELS', '0').strip() == '1'
TRAIN_VERBOSE = int(os.environ.get('TRAIN_VERBOSE', '1'))

EOG_CLEAN = os.environ.get('EOG_CLEAN', '0').strip() == '1'
EOG_HIGHPASS_HZ = float(os.environ.get('EOG_HIGHPASS_HZ', '1.0'))
EOG_ICA_N_COMPONENTS = int(os.environ.get('EOG_ICA_N_COMPONENTS', '12'))
EOG_CORR_THRESHOLD = float(os.environ.get('EOG_CORR_THRESHOLD', '0.35'))
