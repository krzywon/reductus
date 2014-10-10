# This program is public domain
"""
Data corrections for reflectometry.
"""

def apply_standard_corrections(data):
    """
    Standard corrections that all data loaders should apply to put the data
    into plottable form.

    These are:

    #. :class:`divergencecor.AngularDivergence`
    #. :class:`intentcor.Intent`
    #. :class:`normcor.Normalize`

    Each data loader should call *apply_standard_corrections* near the end
    of its load method. The reduction steps are not logged and users may
    override them in their own reduction chain.

    If the format does not define slit parameters, but can otherwise set
    the angular divergence (e.g., a tabletop x-ray machine which records
    the divergence in its datafile), then set the slit parameters with
    arbitrary values (such as 1 mm for slit openings, and -2000 and -1000
    mm for slit distances), call *apply_standard_corrections*, then set
    self.angular_divergence to whatever is indicated in the data file.

    If the format defines the intent, then set data.intent before calling
    *apply_standard_corrections*.  The *Intent* correction uses 'auto', so
    it will preserve the intent in the file, or infer it if it is not present.

    Normalize just sets data.v,data.dv to counts/monitor.  This is easy for
    the user to override if they want a different kind of normalization.
    """
    divergence().apply(data)
    intent('auto').apply(data) # use stored intent if present
    normalize().apply(data)

def intent(*args, **kw):
    """Mark the intent of the measurement"""
    from .intentcor import InferIntent
    return InferIntent(*args, **kw)

def divergence(*args, **kw):
    """Compute angular divergence"""
    from .divergencecor import AngularResolution
    return AngularResolution(*args, **kw)

def normalize(*args, **kw):
    """Normalization correction; should be applied first"""
    from .normcor import Normalize
    return Normalize(*args, **kw)


def polarization_efficiency(*args, **kw):
    """Polarization efficiency correction"""
    from .polcor import PolarizationEfficiency
    return PolarizationEfficiency(*args, **kw)

def align_slits(*args, **kw):
    """Data smoothing using 1-D moving window least squares filter"""
    from .alignslits import AlignSlits
    return AlignSlits(*args, **kw)

def water_intensity(*args, **kw):
    """Intensity estimate from water scatter"""
    from .ratiocor import WaterIntensity
    return WaterIntensity(*args, **kw)

def ratio_intensity(*args, **kw):
    """Intensity estimate from reflection off a standard sample"""
    from .ratiocor import RatioIntensity
    return RatioIntensity(*args, **kw)

def measured_area_correction(*args, **kw):
    """Detector area correction from file"""
    from .areacor import measured_area_correction
    return measured_area_correction(*args,**kw)

def area_correction(*args, **kw):
    """Detector area correction from file"""
    from .areacor import AreaCorrection
    return AreaCorrection(*args,**kw)

def brookhaven_area_correction(*args, **kw):
    """Correct for the standard brookhaven detector pixel width"""
    from .bh_areacor import brookhaven_area_correction
    return brookhaven_area_correction(*args, **kw)

def rescale(*args, **kw):
    """Scale the dataset"""
    from .rescalecor import Rescale
    return Rescale(*args, **kw)
