import numpy as np
from .resolution import divergence

def apply_theta_offset(data, offset):
    data.sample.angle_x += offset
    data.detector.angle_x -= offset


def apply_absolute_angle(data):
    index = (data.sample.angle_x < 0)  # type: np.ndarray
    if np.any(index):
        data.sample.angle_x[index] *= -1.0
        data.detector.angle_x[index] *= -1.0


def apply_back_reflection(data):
    data.sample.angle_x *= -1.0
    data.detector.angle_x *= -1.0


def apply_divergence(data, sample_width, sample_broadening):
    slits = data.slit1.x, data.slit2.x
    distance = abs(data.slit1.distance), abs(data.slit2.distance)
    theta = data.sample.angle_x
    # for slit scans, the sample size and angle are irrelevant and
    # need to be excluded from the calculation of divergence:
    use_sample = data.intent != "intensity"
    if sample_width is None:
        sample_width = data.sample.width
    dtheta = divergence(T=theta, slits=slits, distance=distance,
                        use_sample=use_sample,
                        sample_width=sample_width,
                        sample_broadening=sample_broadening)
    #print "divergence",theta,slits,distance,sample_width,sample_broadening,dtheta
    data.angular_resolution = dtheta
